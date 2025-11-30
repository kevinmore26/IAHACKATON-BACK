import ffmpeg from 'fluent-ffmpeg';


export async function stitchVideos(
  videoPaths: string[],
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (videoPaths.length === 0) {
      return reject(new Error('No videos to stitch'));
    }

    const command = ffmpeg();

    // Add each video input
    videoPaths.forEach((path) => {
      command.input(path);
    });

    // Create a complex filter to scale all inputs to 720x1280 (9:16) and concatenate
    // This ensures that if inputs have slightly different dimensions, they are normalized.
    // We assume 720x1280 as a standard 9:16 HD resolution.
    
    const filterInputs = videoPaths.map((_, i) => `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2[v${i}];`).join('');
    // Interleave video and audio streams for concat: [v0][0:a][v1][1:a]...
    const concatFilter = videoPaths.map((_, i) => `[v${i}][${i}:a]`).join('') + `concat=n=${videoPaths.length}:v=1:a=1[outv][outa]`;

    // Note: We are now including audio (a=1).
    // We assume all input videos have an audio stream.

    command
      .complexFilter(filterInputs + concatFilter)
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
