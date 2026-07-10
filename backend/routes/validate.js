const express = require('express');
const router = express.Router();
const multer = require('multer');
const Validation = require('../models/Validation');
const auth = require('../middleware/auth');
const { extractText } = require('../utils/extractor');

// Configure multer to store file uploads in a memory buffer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// @route   POST api/validate/extract
// @desc    Extract text from uploaded academic documents
// @access  Private
router.post('/extract', [auth, upload.single('file')], async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const text = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
    const title = req.file.originalname.replace(/\.[^/.]+$/, "");
    res.json({ text, title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to extract text: ' + err.message });
  }
});

// @route   POST api/validate/check
// @desc    Perform authenticity analysis on academic text or document upload
// @access  Private
router.post('/check', [auth, upload.single('file')], async (req, res) => {
  let title, text;

  if (req.file) {
    try {
      text = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
      title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "");
    } catch (err) {
      return res.status(500).json({ message: 'Failed to extract text: ' + err.message });
    }
  } else {
    title = req.body.title;
    text = req.body.text;
  }

  if (!title || !text || text.trim().length < 50) {
    return res.status(400).json({ message: 'Document title and at least 50 characters of text are required' });
  }

  try {
    const textLength = text.length;

    // --- ALGORITHM FOR ACADEMIC AUTHENTICITY ---
    
    // 1. Plagiarism Score Estimation
    // We simulate plagiarism by searching for common generic copying phrases or sentence structures.
    // In a production app, this would query global academic indexes.
    const genericPhrases = [
      'it has been widely accepted', 'studies have shown that', 'according to research',
      'in order to understand', 'the results of this study', 'as mentioned previously'
    ];
    let phraseMatches = 0;
    genericPhrases.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      const matches = text.match(regex);
      if (matches) phraseMatches += matches.length;
    });
    // Higher phrase match count + slight randomness creates a realistic plagiarism index
    const plagiarismBase = Math.min(45, phraseMatches * 8);
    const plagiarismScore = Math.max(0, Math.min(100, Math.round(plagiarismBase + (Math.random() * 15))));

    // 2. AI footprint analysis (Transition word density & structure variance)
    // AI text usually features high densities of transitional adverbs and overly clean structures.
    const aiTransitionalWords = [
      'furthermore', 'moreover', 'consequently', 'nonetheless', 'therefore', 
      'in conclusion', 'it is important to note', 'testament to', 'delve', 
      'tapestry', 'not only', 'but also', 'firstly', 'secondly', 'lastly'
    ];
    let aiWordCount = 0;
    aiTransitionalWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) aiWordCount += matches.length;
    });
    // AI Score calculation based on transition word density (per 100 words)
    const wordCount = text.split(/\s+/).length;
    const aiDensity = (aiWordCount / wordCount) * 100;
    let aiScore = 0;
    if (aiDensity > 4) {
      aiScore = Math.round(Math.min(95, 55 + (aiDensity * 7)));
    } else if (aiDensity > 1.5) {
      aiScore = Math.round(30 + (aiDensity * 8));
    } else {
      aiScore = Math.round(Math.max(5, 10 + (Math.random() * 15)));
    }

    // 3. Citation Authenticity Index
    // Search for citations matching IEEE style [1], [1, 2] or Harvard style (Author, 2021) or MLA/et al.
    const ieeeRegex = /\[\d+\]|\[\d+\s*,\s*\d+\]/g;
    const harvardRegex = /\([A-Z][a-zA-Z]+(,\s*\d{4}|\s*et\s*al\.\s*,\s*\d{4})\)/g;
    
    const ieeeMatches = text.match(ieeeRegex) || [];
    const harvardMatches = text.match(harvardRegex) || [];
    const totalCitations = ieeeMatches.length + harvardMatches.length;

    // Density of citations: ideal is at least 1 citation per 150 words in academia.
    const citationDensity = (totalCitations / wordCount) * 150;
    let citationScore = Math.min(100, Math.round(citationDensity * 35));
    if (totalCitations > 0 && citationScore < 30) citationScore = 30; // Base score for having citations

    // 4. Overall Authenticity Score
    // Authenticity is high if Plagiarism is low, AI likelihood is low, and Citations are sound.
    // Weights: 40% low-plagiarism, 40% low-AI, 20% citation-density
    const plagiarismWeight = (100 - plagiarismScore) * 0.40;
    const aiWeight = (100 - aiScore) * 0.40;
    const citationWeight = citationScore * 0.20;

    const overallScore = Math.max(0, Math.min(100, Math.round(plagiarismWeight + aiWeight + citationWeight)));

    // Set validation status threshold
    let status = 'Verified';
    if (overallScore < 50) {
      status = 'Critical';
    } else if (overallScore < 75) {
      status = 'Caution';
    }

    const validation = new Validation({
      userId: req.user.id,
      title,
      textLength,
      plagiarismScore,
      aiScore,
      citationScore,
      overallScore,
      status
    });

    await validation.save();
    res.json(validation);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Analysis failed. Server error' });
  }
});

// @route   GET api/validate/history
// @desc    Get user's validation history
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const history = await Validation.find({ userId: req.user.id });
    res.json(history);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to retrieve validation history' });
  }
});

// @route   DELETE api/validate/history/:id
// @desc    Delete a verification record
// @access  Private
router.delete('/history/:id', auth, async (req, res) => {
  try {
    const record = await Validation.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!record) {
      return res.status(404).json({ message: 'Record not found or unauthorized' });
    }
    res.json({ message: 'Record deleted successfully', id: req.params.id });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to delete record' });
  }
});

module.exports = router;
