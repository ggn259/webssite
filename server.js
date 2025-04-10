require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Set trust proxy for Render's HTTPS
app.set('trust proxy', 1);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.json({ status: 'Server is running', message: 'Ideogram API integration server' });
});

// Generate image endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, aspect_ratio = "1:1" } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Call Ideogram API to generate image
    const ideogramResponse = await axios.post('https://api.ideogram.ai/generate', {
      prompt,
      aspect_ratio
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.IDEOGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ideogramResponse.data || !ideogramResponse.data.images || ideogramResponse.data.images.length === 0) {
      return res.status(500).json({ error: 'Failed to generate image' });
    }
    
    // Get image URL from Ideogram response
    const imageUrl = ideogramResponse.data.images[0];
    
    // Download image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    // Convert to PNG using Sharp
    const pngBuffer = await sharp(imageResponse.data)
      .png()
      .toBuffer();
    
    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ 
        folder: 'ideogram-images',
        format: 'png'
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }).end(pngBuffer);
    });
    
    res.json({ 
      success: true, 
      original_url: imageUrl,
      cloudinary_url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });
  } catch (error) {
    console.error('Error generating image:', error.message);
    res.status(500).json({ error: error.message || 'Failed to process image' });
  }
});

// Reframe image endpoint
app.post('/api/reframe', async (req, res) => {
  try {
    const { image_url, aspect_ratio = "1:1" } = req.body;
    
    if (!image_url) {
      return res.status(400).json({ error: 'Image URL is required' });
    }
    
    // Call Ideogram API to reframe image
    const ideogramResponse = await axios.post('https://api.ideogram.ai/reframe', {
      image_url,
      aspect_ratio
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.IDEOGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ideogramResponse.data || !ideogramResponse.data.image) {
      return res.status(500).json({ error: 'Failed to reframe image' });
    }
    
    // Get image URL from Ideogram response
    const reframedImageUrl = ideogramResponse.data.image;
    
    // Download image
    const imageResponse = await axios.get(reframedImageUrl, { responseType: 'arraybuffer' });
    
    // Convert to PNG using Sharp
    const pngBuffer = await sharp(imageResponse.data)
      .png()
      .toBuffer();
    
    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ 
        folder: 'ideogram-reframed',
        format: 'png'
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }).end(pngBuffer);
    });
    
    res.json({ 
      success: true, 
      original_url: reframedImageUrl,
      cloudinary_url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });
  } catch (error) {
    console.error('Error reframing image:', error.message);
    res.status(500).json({ error: error.message || 'Failed to reframe image' });
  }
});

// Remix image endpoint
app.post('/api/remix', upload.single('image'), async (req, res) => {
  try {
    let imageUrl;
    
    // Check if image is provided via file upload or URL
    if (req.file) {
      // Upload the file to Cloudinary first to get a URL
      const tempUpload = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ 
          folder: 'temp-uploads',
        }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }).end(req.file.buffer);
      });
      
      imageUrl = tempUpload.secure_url;
    } else if (req.body.image_url) {
      imageUrl = req.body.image_url;
    } else {
      return res.status(400).json({ error: 'Image (file or URL) is required' });
    }
    
    const { prompt, aspect_ratio = "1:1" } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Call Ideogram API to remix image
    const ideogramResponse = await axios.post('https://api.ideogram.ai/remix', {
      image_url: imageUrl,
      prompt,
      aspect_ratio
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.IDEOGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ideogramResponse.data || !ideogramResponse.data.images || ideogramResponse.data.images.length === 0) {
      return res.status(500).json({ error: 'Failed to remix image' });
    }
    
    // Get image URL from Ideogram response
    const remixedImageUrl = ideogramResponse.data.images[0];
    
    // Download image
    const imageResponse = await axios.get(remixedImageUrl, { responseType: 'arraybuffer' });
    
    // Convert to PNG using Sharp
    const pngBuffer = await sharp(imageResponse.data)
      .png()
      .toBuffer();
    
    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ 
        folder: 'ideogram-remixed',
        format: 'png'
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }).end(pngBuffer);
    });
    
    res.json({ 
      success: true, 
      original_url: remixedImageUrl,
      cloudinary_url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });
  } catch (error) {
    console.error('Error remixing image:', error.message);
    res.status(500).json({ error: error.message || 'Failed to remix image' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
