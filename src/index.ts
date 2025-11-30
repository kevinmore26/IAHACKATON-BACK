import { config } from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  config();
}

// call after config() to access the env variables
import { app } from './api';
import { env } from './env';
import { checkFfmpeg } from './lib/video-processor';

const port = env.PORT || 3333;

app.listen(port, async () => {
  console.log(`Backend-base API available on http://localhost:${port}`);
  
  try {
    await checkFfmpeg();
  } catch (error) {
    console.error('WARNING: FFmpeg check failed on startup. Video processing may not work.');
  }
});
