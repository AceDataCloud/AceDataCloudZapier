# ACE Music in Zapier

Use an Ace Data Cloud application key with access to `/acemusic/audios` and `/acemusic/tasks`. Choose **Generate ACE Music Song** for a musical idea or **Create Custom ACE Music Song** to supply your own lyrics, title and style. Importing a public HTTPS MP3 is a separate paid action. Use the delivered track ID in **Cover ACE Music Track**, or select two distinct owned track IDs for **Blend ACE Music Tracks**.

Paid editor tests create tasks. Each action submits once and waits for a callback. On resume, Zapier verifies the original task using your application credential. A partial result keeps delivered audio and has `status: partial_failed` and `success: false`. To recover an interrupted run, use **Retrieve ACE Music Task** with the original task ID. [API contract](https://github.com/AceDataCloud/ACEMusicAPI)
