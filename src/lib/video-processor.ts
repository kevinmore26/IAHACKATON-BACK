import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { AlignmentData } from './elevenlabs';


export const ENABLE_TRIM = true;
export const TRIM_START_SECONDS = 0.5;
export const TRIM_END_SECONDS = 0.5;

export async function stitchVideos(
  videoPaths: string[],
  outputPath: string
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if (videoPaths.length === 0) {
      return reject(new Error('No videos to stitch'));
    }

    const command = ffmpeg();

    // Add each video input
    videoPaths.forEach((path) => {
      command.input(path);
    });

    try {
      let concatFilter = '';
      
      if (ENABLE_TRIM) {
        // We need durations to trim the end
        const getDuration = (path: string): Promise<number> => {
          return new Promise((res, rej) => {
            ffmpeg.ffprobe(path, (err, metadata) => {
              if (err) return rej(err);
              res(metadata.format.duration || 0);
            });
          });
        };

        const durations = await Promise.all(videoPaths.map(p => getDuration(p)));
        
        // Build filter chain for trimming
        // [0:v]trim=start=0.5:duration=4,setpts=PTS-STARTPTS[v0];
        const inputs = videoPaths.map((_, i) => {
          const duration = durations[i];
          const keepDuration = Math.max(0, duration - TRIM_START_SECONDS - TRIM_END_SECONDS);
          
          // Video trim
          const vTrim = `[${i}:v]trim=start=${TRIM_START_SECONDS}:duration=${keepDuration},setpts=PTS-STARTPTS[v${i}]`;
          // Audio trim
          const aTrim = `[${i}:a]atrim=start=${TRIM_START_SECONDS}:duration=${keepDuration},asetpts=PTS-STARTPTS[a${i}]`;
          
          return `${vTrim};${aTrim}`;
        }).join(';');

        const concat = videoPaths.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${videoPaths.length}:v=1:a=1[outv][outa]`;
        
        concatFilter = `${inputs};${concat}`;
      } else {
        // Simple concat without processing
        concatFilter = videoPaths.map((_, i) => `[${i}:v][${i}:a]`).join('') + `concat=n=${videoPaths.length}:v=1:a=1[outv][outa]`;
      }

      command
        .complexFilter(concatFilter)
        .outputOptions('-map [outv]')
        .outputOptions('-map [outa]')
        .outputOptions('-c:v libx264')
        .outputOptions('-pix_fmt yuv420p')
        .save(outputPath)
        .on('end', () => {
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        });

    } catch (error) {
      reject(error);
    }
  });
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(outputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function replaceAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions('-c:v copy') // Copy video stream without re-encoding
      .outputOptions('-c:a aac') // Re-encode audio to AAC
      .outputOptions('-map 0:v:0') // Use video from first input
      .outputOptions('-map 1:a:0') // Use audio from second input
      .outputOptions('-shortest') // Finish when the shortest input ends
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export async function createSubtitleFile(alignment: AlignmentData, outputPath: string): Promise<void> {
    // Group characters into words
    const words: { text: string; start: number; end: number }[] = [];
    let currentWord = '';
    let wordStart = -1;

    for (let i = 0; i < alignment.characters.length; i++) {
        const charObj = alignment.characters[i];
        const char = charObj.text;
        const start = charObj.start;

        if (wordStart === -1) wordStart = start;

        if (char === ' ') {
            if (currentWord) {
                // Use the end time of the previous character (which was the last char of the word)
                // We need to be careful with index 0, but if currentWord is not empty, i > 0
                const prevCharObj = alignment.characters[i-1];
                words.push({ text: currentWord, start: wordStart, end: prevCharObj.end });
                currentWord = '';
                wordStart = -1;
            }
        } else {
            currentWord += char;
        }
    }
    if (currentWord) {
        const lastCharObj = alignment.characters[alignment.characters.length - 1];
        words.push({ text: currentWord, start: wordStart, end: lastCharObj.end });
    }

    // Group words into caption segments (TikTok style: 1-3 words)
    const segments: { text: string; start: number; end: number }[] = [];
    let currentSegment: typeof words = [];
    
    for (const word of words) {
        currentSegment.push(word);
        
        // Break if segment is long enough or ends with punctuation
        const isLongEnough = currentSegment.length >= 3; // Max 3 words
        const endsWithPunctuation = /[.!?]$/.test(word.text);
        
        if (isLongEnough || endsWithPunctuation) {
            segments.push({
                text: currentSegment.map(w => w.text).join(' '),
                start: currentSegment[0].start,
                end: currentSegment[currentSegment.length - 1].end
            });
            currentSegment = [];
        }
    }
    if (currentSegment.length > 0) {
        segments.push({
            text: currentSegment.map(w => w.text).join(' '),
            start: currentSegment[0].start,
            end: currentSegment[currentSegment.length - 1].end
        });
    }

    // Generate ASS content
    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,80,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,0,2,10,10,350,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events = segments.map(seg => {
        return `Dialogue: 0,${formatTime(seg.start)},${formatTime(seg.end)},Default,,0,0,0,,${seg.text.toUpperCase()}`;
    }).join('\n');

    fs.writeFileSync(outputPath, header + events);
}

export async function burnCaptions(videoPath: string, subtitlePath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // We need to use the fonts directory
        const fontDir = path.join(process.cwd(), 'assets', 'fonts');
        
        ffmpeg(videoPath)
            .outputOptions([
                `-vf subtitles=${subtitlePath}:fontsdir=${fontDir}`,
                '-c:a copy'
            ])
            .save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => {
                console.error('Error burning captions:', err);
                reject(err);
            });
    });
}

export async function checkFfmpeg(): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg.getAvailableFormats((err, formats) => {
      if (err) {
        console.error('FFmpeg check failed:', err);
        reject(new Error('FFmpeg is not installed or not available'));
      } else {
        console.log('FFmpeg is installed and available');
        resolve();
      }
    });
  });
}
