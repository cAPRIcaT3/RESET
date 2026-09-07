# GitHub Actions setup checklist

1. Create/push the RESET repository and make sure these workflow files are on the default branch.
2. In **Settings -> Pages**, choose **GitHub Actions** as the deployment source.
3. Optional: in **Settings -> Secrets and variables -> Actions -> Variables**, add `RESET_USER_PLACE` with a coarse value such as `Bengaluru, India`.
4. Open **Actions -> Model render smoke test -> Run workflow**. This renders one Gemma/Kokoro scene and uploads it as an artifact.
5. If the smoke test succeeds, run **Render daily RESET deck** manually with `count=4`.
6. Open the Pages URL and verify scene text, dock timestamp, and pre-rendered audio.
7. Run the daily workflow again with `count=24` or leave the default schedule enabled.

The schedule is set to **02:37 Asia/Kolkata**, deliberately away from the top of the hour.

No Gemma or Kokoro weights should be committed to Git. The workflows cache model payloads separately.
