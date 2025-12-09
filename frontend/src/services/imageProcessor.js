// frontend/src/services/imageProcessor.js

/**
 * Standardizes an image to a fixed size using canvas.
 * Uses 'cover' behavior - scales to fill, crops edges if needed.
 * 
 * @param {File|Blob} imageFile - The uploaded image file
 * @param {number} targetWidth - Desired width (default: 1920)
 * @param {number} targetHeight - Desired height (default: 1080)
 * @returns {Promise<Blob>} - Processed image as a Blob
 */
export const standardizeBackgroundImage = async (
    imageFile, 
    targetWidth = 1920, 
    targetHeight = 1080
) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                // Create canvas with target dimensions
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                
                // Calculate scaling to cover (like CSS background-size: cover)
                const imgRatio = img.width / img.height;
                const canvasRatio = targetWidth / targetHeight;
                
                let drawWidth, drawHeight, offsetX, offsetY;
                
                if (imgRatio > canvasRatio) {
                    // Image is wider - fit to height, crop sides
                    drawHeight = targetHeight;
                    drawWidth = img.width * (targetHeight / img.height);
                    offsetX = (targetWidth - drawWidth) / 2;
                    offsetY = 0;
                } else {
                    // Image is taller - fit to width, crop top/bottom
                    drawWidth = targetWidth;
                    drawHeight = img.height * (targetWidth / img.width);
                    offsetX = 0;
                    offsetY = (targetHeight - drawHeight) / 2;
                }
                
                // Draw the scaled and cropped image
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                
                // Convert canvas to blob
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create image blob'));
                    }
                }, 'image/png');
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(imageFile);
    });
};

/**
 * Alternative: Fit the image inside the target dimensions (contain behavior)
 * This version doesn't crop - adds padding if needed
 */
export const standardizeBackgroundImageContain = async (
    imageFile, 
    targetWidth = 1920, 
    targetHeight = 1080,
    backgroundColor = '#ffffff'
) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                
                // Fill background
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                
                // Calculate scaling to contain (like CSS background-size: contain)
                const scale = Math.min(
                    targetWidth / img.width,
                    targetHeight / img.height
                );
                
                const drawWidth = img.width * scale;
                const drawHeight = img.height * scale;
                const offsetX = (targetWidth - drawWidth) / 2;
                const offsetY = (targetHeight - drawHeight) / 2;
                
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create image blob'));
                    }
                }, 'image/png');
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(imageFile);
    });
};