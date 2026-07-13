#!/bin/zsh

# Check if filename argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <filename>"
    echo "Example: $0 my_title"
    exit 1
fi

# Get the filename from the first argument
filename="$1"

# Allow per-request directories via environment variables, falling back to defaults
WORKING_DIR="${WORKING_DIR:-./src/content/2.working}"
DONE_DIR="${DONE_DIR:-./src/content/3.done}"

# Set the directory containing the MP3 files - directly under working/audio/
directory="$WORKING_DIR/audio"

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

# Output directory in DONE_DIR
output_dir="$DONE_DIR/$filename"

# Create output directory if it doesn't exist
mkdir -p "$output_dir"

# Run FFmpeg to concatenate the MP3 files and compress the audio to 128 kbps bitrate
# -y flag automatically overwrites existing files without prompting
ffmpeg -y -i "concat:$files" -b:a 128k "$output_dir/$filename.mp3"
