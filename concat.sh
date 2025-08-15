#!/bin/zsh

# Set the directory containing the MP3 files
directory="./audio/daniel_in_babylon"

# Initialize an empty string to store the file list
files=""

# Loop through all MP3 files in the directory and sort them numerically
for file in $(ls $directory/*.mp3 | sort -V); do
    # Append each file path to the files string, separated by the pipe character |
    files+="|$file"
done

# Remove the leading pipe character from the files string
files="${files#|}"

# Run FFmpeg to concatenate the MP3 files and compress the audio to 128 kbps bitrate
ffmpeg -i "concat:$files" -b:a 128k ./audio/daniel_in_babylon/complete.mp3
