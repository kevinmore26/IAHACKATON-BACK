# Current Application Flow

This document outlines the current backend flow for the AI Video Generation application.

## 1. Organization Setup
**Endpoint:** `POST /api/v1/organizations`

The user creates an organization profile. The system automatically generates a "Business Brief" using AI to guide future content generation.

### Input (JSON)
```json
{
  "name": "Linconsa",
  "business_type": "Accounting Firm",
  "main_product": "Tax and Accounting Services for SMEs",
  "content_objective": "Attract new small business clients",
  "target_audience": "Small business owners in Peru"
}
```

### Process
1.  Validates input fields.
2.  Generates a unique `slug` from the name.
3.  **AI Step:** Calls `generateBusinessBrief` to create a concise summary of the business.
4.  Saves to `organizations` table.
5.  Links user as ADMIN in `user_organizations`.

### Output
Returns the created organization object, including the AI-generated `business_brief`.

---

## 2. Content Idea Generation
**Endpoint:** `POST /api/v1/organizations/:id/ideas`

Generates a list of short video concepts based on the organization's profile.

### Input (JSON)
```json
{
  "count": 5 // Optional, default is 7
}
```

### Process
1.  Fetches organization details (including the `business_brief`).
2.  **AI Step:** Calls `generateContentIdeas` using Google GenAI (Flash 2.5).
    *   **Prompt Context:** Name, Type, Product, Objective, Audience, Brief.
    *   **Output Schema:**
        ```typescript
        Array<{
          title: string; // Catchy title
          script: string; // Short summary/script (10-20s)
        }>
        ```
3.  Saves ideas to `content_ideas` table.

### Output
Returns a list of generated content ideas.

---

## 3. Script & Block Generation
**Endpoint:** `POST /api/v1/scripts/generate`

Takes a specific content idea and expands it into a detailed, scene-by-scene video script (Blocks).

### Input (JSON)
```json
{
  "ideaId": "uuid-of-content-idea"
}
```

### Process
1.  Fetches the `content_idea` by ID.
2.  **AI Step:** Calls `generateScript` using the idea's title and summary.
    *   **Goal:** Create a viral, organic video script under 20 seconds.
    *   **Output Schema (Blocks):**
        ```typescript
        {
          blocks: Array<{
            type: "NARRATOR" | "SHOWCASE";
            durationTarget: number; // Seconds
            script: string; // Voiceover or spoken words
            userInstructions: string; // Direction for the user
          }>
        }
        ```
3.  **Database Transaction:**
    *   Updates `content_idea` status to `SCRIPTED`.
    *   Deletes any existing blocks for this idea (allows regeneration).
    *   Saves new blocks to `video_blocks` table with status `WAITING_INPUT`.

### Block Types
*   **NARRATOR:** Talking head style. User speaks to camera.
*   **SHOWCASE:** B-roll style. Visuals of product/service with voiceover.

### Output
Returns the list of created video blocks.

---

## Database Schema (Relevant Parts)

### `organizations`
*   `id`, `name`, `slug`, `business_brief`, `...details`

### `content_ideas`
*   `id`, `organization_id`, `title`, `script`, `status` (default: 'IDEA')

### `video_blocks`
*   `id`, `content_idea_id`
*   `type` (NARRATOR, SHOWCASE)
*   `script` (Text to speak)
*   `instructions` (Visual directions)
*   `duration_target` (Seconds)
*   `order` (Sequence index)
*   `status` (WAITING_INPUT, READY, etc.)

---

## 4. Block Media & Generation
**Endpoints:**
*   `POST /api/v1/blocks/:id/upload` (Multipart Form Data)
*   `POST /api/v1/blocks/:id/generate`

Handles the media content for each block.

### Upload Input (Multipart)
*   `file`: Image (for generation) or Video (for direct use).

### Generation Process
1.  **Upload**: User uploads an image (for NARRATOR/SHOWCASE generation) or a video (to use directly).
2.  **Generate**: User triggers generation for a block.
    *   **Input**: Uses the uploaded image and the block's script.
    *   **AI Step**: Calls Google Veo (VideoFX) to generate a video clip (4, 6, or 8s).
    *   **Output**: Saves the generated video path.

### Output
Returns the updated block object with `input_media_path` or `generated_video_path`.

---

## 5. Final Video Rendering
**Endpoint:** `POST /api/v1/scripts/:id/render`

Stitches all block videos into a final result.

### Process
1.  Validates that all blocks have a video (either uploaded or generated).
2.  Downloads all video clips.
3.  **Processing**: Stitches clips together using `ffmpeg` (normalizing to 9:16).
4.  Uploads the final video to storage.
5.  Updates the `content_idea` status to `COMPLETED`.

### Output
Returns the updated content idea with `final_video_path`.
