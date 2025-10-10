# Upload Fix - Files Not Appearing in Pending Directory

## 🐛 Problem

When users uploaded images, the success message appeared but the files were not actually saved in the `1.pending` directory.

## 🔍 Root Cause

The original implementation had a critical timing issue:

1. **Multer middleware** runs first and uploads files to `1.pending/`
2. **Then** the endpoint handler runs and clears the `1.pending/` directory
3. **Result**: Files were uploaded then immediately deleted!

```javascript
// WRONG - This deletes files AFTER they're uploaded
app.post("/api/upload-images", upload.array("images"), (req, res) => {
  // Multer has already saved files here ↑
  
  // Now we delete them! ❌
  clearDirectory(pendingDir);
  
  // Files are gone!
});
```

## ✅ Solution

Split the process into two separate endpoints:

### 1. Clear Endpoint (Called First)
```javascript
POST /api/clear-pending
```
- Deletes all files in `1.pending/`
- Creates directory if it doesn't exist
- Returns success

### 2. Upload Endpoint (Called Second)
```javascript
POST /api/upload-images
```
- Multer saves files to `1.pending/`
- Returns list of uploaded files
- Files remain in directory ✅

## 🔧 Changes Made

### Backend (server.mjs)

**New Endpoint - Clear Pending:**
```javascript
app.post("/api/clear-pending", (req, res) => {
  const pendingDir = process.env.PENDING_DIR;
  
  // Delete all files
  if (fs.existsSync(pendingDir)) {
    const existingFiles = fs.readdirSync(pendingDir);
    for (const file of existingFiles) {
      const filePath = path.join(pendingDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
  } else {
    // Create if doesn't exist
    fs.mkdirSync(pendingDir, { recursive: true });
  }
  
  res.json({ success: true });
});
```

**Updated Endpoint - Upload Images:**
```javascript
app.post("/api/upload-images", upload.array("images"), (req, res) => {
  // Multer has already saved files
  const uploadedFiles = req.files || [];
  
  // Just return success - don't delete anything!
  res.json({
    success: true,
    files: uploadedFiles.map((f) => f.filename),
  });
});
```

### Frontend (script.js)

**Updated Upload Flow:**
```javascript
async handleFiles(files) {
  // Step 1: Clear old images FIRST
  await fetch("/api/clear-pending", { method: "POST" });
  
  // Step 2: Upload new images
  const formData = new FormData();
  files.forEach(file => formData.append("images", file));
  
  await fetch("/api/upload-images", {
    method: "POST",
    body: formData,
  });
  
  // Step 3: Reload image list
  this.loadImages();
}
```

## 📊 New Upload Flow

```
User drops files
    ↓
1. Call /api/clear-pending
    ↓
   Delete all files in 1.pending/
    ↓
2. Call /api/upload-images
    ↓
   Multer saves new files to 1.pending/
    ↓
3. Files remain in directory ✅
    ↓
4. Reload image list
    ↓
   User sees uploaded images
```

## 🎯 Progress Indicators

The upload now shows two stages:

1. **"Clearing old images..."** (25% progress)
   - Calls `/api/clear-pending`
   - Deletes existing files

2. **"Uploading X images..."** (50% progress)
   - Calls `/api/upload-images`
   - Saves new files

3. **"✅ Uploaded X images successfully!"** (100% progress)
   - Upload complete
   - Files are in `1.pending/`

## 🧪 Testing

To verify the fix works:

1. **Upload some images**
   - Drag and drop or click to browse
   - Wait for success message

2. **Check the directory**
   ```bash
   ls src/content/1.pending/
   ```
   - Files should be there ✅

3. **Upload again**
   - Old files should be deleted
   - New files should appear

4. **Check the image list**
   - Should show the uploaded images
   - Count should match uploaded files

## 📝 Console Output

**Successful Upload:**
```
🗑️  Clearing pending directory...
   Deleted: old-image1.jpg
   Deleted: old-image2.png
✅ Pending directory cleared
✅ Uploaded 3 new images
   📁 new-image1.jpg
   📁 new-image2.jpg
   📁 new-image3.jpg
```

## ✅ Result

Files now correctly:
- ✅ Clear old images before upload
- ✅ Save new images to `1.pending/`
- ✅ Remain in directory after upload
- ✅ Appear in the image list
- ✅ Ready for transformation process

## 🔒 Error Handling

Both endpoints have proper error handling:

**Clear Endpoint:**
- Creates directory if missing
- Handles permission errors
- Returns error status if fails

**Upload Endpoint:**
- Validates file types (multer)
- Handles upload errors
- Returns error status if fails

**Frontend:**
- Shows error message if either step fails
- Resets UI after error
- Allows user to retry

## 🎉 Fixed!

The upload feature now works correctly. Images are saved to `1.pending/` and remain there until the next upload or transformation process.

