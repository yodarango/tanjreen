#!/bin/zsh

# Check if filename argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <filename>"
    echo "Example: $0 my_title"
    exit 1
fi

# Get the filename from the first argument
filename="$1"

# Set the directory containing the MP3 files
directory="./src/content/2.working/audio/$filename"

# Check if directory exists
if [ ! -d "$directory" ]; then
    echo "Error: Directory $directory does not exist"
    exit 1
fi

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
ffmpeg -i "concat:$files" -b:a 128k "./src/content/3.complete/$filename/$filename.mp3"
