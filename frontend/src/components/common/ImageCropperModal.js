import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './ImageCropperModal.css';

/**
 * A high-quality image cropping utility.
 * It creates a new image with a fixed width (e.g., 1920px) to ensure high resolution.
 *
 * @param {HTMLImageElement} image - The source image element.
 * @param {Object} crop - The crop parameters from react-image-crop (in percentages).
 * @param {string} fileName - The desired name for the output file.
 * @returns {Promise<string>} A promise that resolves with a Blob URL of the cropped image.
 */
async function getCroppedImg(image, crop, fileName) {
  // Create a new canvas element. This is what we'll draw the cropped image onto.
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // --- High-Resolution Logic ---
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Define our target output resolution. 1920px is a great baseline for a Full HD background.
  const targetWidth = 1920;
  // Calculate the height based on a 16:9 aspect ratio to match the crop box.
  const targetHeight = targetWidth / (16 / 9);

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Improve the drawing quality.
  ctx.imageSmoothingQuality = 'high';

  // Calculate the source crop area in *actual image pixels*, not screen pixels.
  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;

  // Draw the cropped section of the high-resolution source image onto our
  // high-resolution canvas. This performs a quality downscale if necessary.
  ctx.drawImage(
    image,          // The original, full-resolution image
    cropX,          // X coordinate of the source crop
    cropY,          // Y coordinate of the source crop
    cropWidth,      // Width of the source crop
    cropHeight,     // Height of the source crop
    0,              // Destination X on canvas (0)
    0,              // Destination Y on canvas (0)
    targetWidth,    // Destination width (our target resolution)
    targetHeight    // Destination height (our target resolution)
  );
  // --- End of High-Resolution Logic ---

  // Convert the canvas content to a Blob and then to a URL.
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        blob.name = fileName;
        // Clean up any previous blob URLs before creating a new one
        // window.URL.revokeObjectURL(this.fileUrl); 
        const fileUrl = window.URL.createObjectURL(blob);
        resolve(fileUrl);
      },
      'image/png', // Use PNG for higher quality
      0.95 // Set quality to 95%
    );
  });
}


const ImageCropperModal = ({ isOpen, onClose, imageSrc, onCropComplete }) => {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  // Set a 16:9 aspect ratio for the crop box, which is standard for screens
  const aspect = 16 / 9;

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  }

  const handleConfirmCrop = async () => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      try {
        const croppedImageUrl = await getCroppedImg(
          imgRef.current,
          completedCrop,
          'cropped-background.png'
        );
        onCropComplete(croppedImageUrl);
      } catch (e) {
        console.error('Error while cropping:', e);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="cropper-overlay">
      <div className="cropper-content">
        <h2>Crop Background Image</h2>
        <div className="cropper-body">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            // Add a min width/height to guide the user away from tiny, low-res selections
            minWidth={100} 
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imageSrc}
              onLoad={onImageLoad}
              style={{ maxHeight: '70vh' }}
            />
          </ReactCrop>
        </div>
        <div className="cropper-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-confirm" onClick={handleConfirmCrop}>Confirm Crop</button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;