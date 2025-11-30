import { config } from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  config();
}

// call after config() to access the env variables
import { app } from './api';
import { env } from './env';

const port = env.PORT || 3333;

app.listen(port, () =>
  console.log(`Backend-base API available on http://localhost:${port}`)
);
