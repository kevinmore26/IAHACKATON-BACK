import ffmpeg from 'fluent-ffmpeg';


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
