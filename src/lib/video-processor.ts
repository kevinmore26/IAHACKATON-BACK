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
    const concatFilter = videoPaths.map((_, i) => `[v${i}]`).join('') + `concat=n=${videoPaths.length}:v=1:a=0[outv]`;

    // Note: We are currently ignoring audio (a=0) for simplicity as Veo generated videos might be silent or we want to add a voiceover later.
    // If we wanted to keep audio, we'd need to handle that too.
    // For now, let's assume visual stitching only.

    command
      .complexFilter(filterInputs + concatFilter)
      .outputOptions('-map [outv]')
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
