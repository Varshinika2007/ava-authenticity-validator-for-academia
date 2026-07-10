// Dashboard interface operations and API integration

let currentHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Session Protection check
  const user = await checkAuthState();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Display user details
  document.getElementById('user-display').textContent = user.username;

  // Bind Sign Out
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
  });

  // 2. Init UI Handlers
  initTextareaHandlers();
  initFileLoader();
  initFormHandler();
  initResetHandler();

  // 3. Load past validations
  await loadHistory();
});

// Setup word counters and text inputs
function initTextareaHandlers() {
  const textarea = document.getElementById('paper-text');
  const counter = document.getElementById('word-counter');

  textarea.addEventListener('input', () => {
    const text = textarea.value;
    const charCount = text.length;
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    
    counter.textContent = `${wordCount} words | ${charCount} characters`;
  });
}

// Enable loading files locally (txt, pdf, doc/docx, ppt/pptx, images) using backend text extraction
function initFileLoader() {
  const fileLoader = document.getElementById('file-loader');
  const textarea = document.getElementById('paper-text');
  const titleInput = document.getElementById('paper-title');
  const counter = document.getElementById('word-counter');
  const uploadLabel = fileLoader.parentElement;
  
  // Save original button HTML to restore it later
  const originalUploadHTML = uploadLabel.innerHTML;

  fileLoader.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Use filename as default title (removing extension)
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    titleInput.value = nameWithoutExt;

    // Lock UI and show processing states
    uploadLabel.style.pointerEvents = 'none';
    uploadLabel.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Extracting...';
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/validate/extract', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Text extraction failed');
      }

      if (!data.text || data.text.trim().length === 0) {
        throw new Error('Extracted text content is empty.');
      }

      textarea.value = data.text;
      
      // Update words counters
      const charCount = data.text.length;
      const wordCount = data.text.trim() === '' ? 0 : data.text.trim().split(/\s+/).length;
      counter.textContent = `${wordCount} words | ${charCount} characters`;
      
      showToast(`Successfully extracted ${wordCount} words from "${file.name}"`, 'success');

    } catch (error) {
      console.error('File load failure:', error);
      showToast(`Extraction failed: ${error.message}`, 'error');
    } finally {
      // Restore Button state
      uploadLabel.style.pointerEvents = 'auto';
      uploadLabel.innerHTML = originalUploadHTML;
      
      // Reset input file loader so user can select same file again if desired
      const refreshLoader = document.getElementById('file-loader');
      if (refreshLoader) {
        refreshLoader.value = '';
        // Re-initialize loader element hook by triggering the loader init sequence
        initFileLoader();
      }
    }
  });
}

// Handler for Analysis Submission
function initFormHandler() {
  const form = document.getElementById('analyzer-form');
  const inputSection = document.getElementById('input-section');
  const loadingSection = document.getElementById('loading-section');
  const loadingStage = document.getElementById('loading-stage');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('paper-title').value.trim();
    const text = document.getElementById('paper-text').value.trim();

    if (text.length < 50) {
      showToast('Document text must be at least 50 characters.', 'error');
      return;
    }

    // Toggle Panels
    inputSection.style.display = 'none';
    loadingSection.style.display = 'flex';
    document.getElementById('empty-state-section').style.display = 'none';
    document.getElementById('result-section').style.display = 'none';

    // Simulated multi-stage verification steps
    const stages = [
      'Scanning linguistic patterns...',
      'Searching cross-citation referencing indexes...',
      'Computing perplexity and sentence structure distribution...',
      'Synthesizing metrics and building signature maps...'
    ];

    let currentStageIndex = 0;
    const stageTimer = setInterval(() => {
      if (currentStageIndex < stages.length - 1) {
        currentStageIndex++;
        loadingStage.textContent = stages[currentStageIndex];
      }
    }, 1200);

    try {
      const response = await fetch('/api/validate/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text })
      });

      const data = await response.json();

      clearInterval(stageTimer);

      if (!response.ok) {
        throw new Error(data.message || 'Validation failed');
      }

      // Render the results
      renderResults(data);
      
      // Update history list
      await loadHistory();

      showToast('Analysis completed successfully!', 'success');

    } catch (error) {
      clearInterval(stageTimer);
      showToast(error.message, 'error');
      
      // Return to input panel
      inputSection.style.display = 'block';
      loadingSection.style.display = 'none';
      document.getElementById('empty-state-section').style.display = 'flex';
    }
  });
}

// Renders validation data to results card
function renderResults(data) {
  document.getElementById('loading-section').style.display = 'none';
  const resultPanel = document.getElementById('result-section');
  resultPanel.style.display = 'flex';

  // Meta Text updates
  document.getElementById('result-title').textContent = data.title;
  const analysisDate = new Date(data.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  document.getElementById('result-meta').textContent = `Analyzed on: ${analysisDate} | Size: ${data.textLength} characters`;

  // Animate Gauge Ring
  const gaugeRing = document.getElementById('overall-gauge');
  const percentageDisplay = document.getElementById('overall-percentage');
  const badgeDisplay = document.getElementById('overall-badge');
  const score = data.overallScore;

  // Gauge Circumference (2 * PI * r) with r=75
  const circumference = 2 * Math.PI * 75; // ~471.2
  const offset = circumference - (circumference * score) / 100;
  
  // Reset dash offset first to trigger CSS animation transition
  gaugeRing.style.strokeDashoffset = circumference;
  
  // Determine Status color and badge text
  let colorVar = '--color-success';
  let badgeClass = 'badge-verified';
  
  if (data.status === 'Critical') {
    colorVar = '--color-danger';
    badgeClass = 'badge-critical';
  } else if (data.status === 'Caution') {
    colorVar = '--color-warning';
    badgeClass = 'badge-caution';
  }

  // Set visual elements
  setTimeout(() => {
    gaugeRing.style.stroke = `var(${colorVar})`;
    gaugeRing.style.strokeDashoffset = offset;
    percentageDisplay.textContent = `${score}%`;
    percentageDisplay.style.color = `var(${colorVar})`;
    
    badgeDisplay.textContent = data.status;
    badgeDisplay.className = `history-badge ${badgeClass}`;
  }, 100);

  // Animate progress bars
  animateProgressBar('ai-progress-bar', 'ai-score-text', data.aiScore);
  animateProgressBar('plagiarism-progress-bar', 'plagiarism-score-text', data.plagiarismScore);
  animateProgressBar('citation-progress-bar', 'citation-score-text', data.citationScore);

  // Update recommendations card
  const recTitle = document.getElementById('rec-title');
  const recDesc = document.getElementById('rec-desc');
  const recCard = document.getElementById('recommendation-card');

  if (data.status === 'Verified') {
    recCard.style.borderLeftColor = 'var(--color-success)';
    recCard.style.background = 'rgba(16, 185, 129, 0.03)';
    recTitle.textContent = 'Verification Recommendation: Verified Academic Integrity';
    recTitle.style.color = 'var(--color-success)';
    recDesc.textContent = 'This document satisfies standard originality parameters. AI-footprint likelihood remains within organic scholarly deviation levels, and citation distributions align with rigorous bibliographic styles.';
  } else if (data.status === 'Caution') {
    recCard.style.borderLeftColor = 'var(--color-warning)';
    recCard.style.background = 'rgba(245, 158, 11, 0.03)';
    recTitle.textContent = 'Verification Recommendation: Cautionary Assessment';
    recTitle.style.color = 'var(--color-warning)';
    recDesc.textContent = 'The analyzer flagged potential anomalies. This document shows elevated transition-word frequencies which may indicate LLM paraphrase synthesis. Additionally, verify citation references to ensure adequate source attribution.';
  } else {
    recCard.style.borderLeftColor = 'var(--color-danger)';
    recCard.style.background = 'rgba(239, 68, 68, 0.03)';
    recTitle.textContent = 'Verification Recommendation: Critical Review Required';
    recTitle.style.color = 'var(--color-danger)';
    recDesc.textContent = 'High probability of non-authentic content detected. Plagiarism signatures and/or machine-generation features significantly exceed normal academic margins. Immediate manually guided validation is strongly recommended.';
  }
}

// Progress Bar Helper
function animateProgressBar(barId, textId, score) {
  const bar = document.getElementById(barId);
  const text = document.getElementById(textId);
  
  bar.style.width = '0%';
  text.textContent = '0%';
  
  setTimeout(() => {
    bar.style.width = `${score}%`;
    text.textContent = `${score}%`;
  }, 150);
}

// Clear results and open input screen
function initResetHandler() {
  const resetBtn = document.getElementById('reset-btn');
  resetBtn.addEventListener('click', () => {
    document.getElementById('analyzer-form').reset();
    document.getElementById('word-counter').textContent = '0 words | 0 characters';
    
    // Toggle Panels
    document.getElementById('input-section').style.display = 'block';
    document.getElementById('result-section').style.display = 'none';
    document.getElementById('empty-state-section').style.display = 'flex';
  });
}

// Fetch history list from database
async function loadHistory() {
  const historyContainer = document.getElementById('history-container');
  
  try {
    const response = await fetch('/api/validate/history');
    if (!response.ok) throw new Error('Could not retrieve history');

    currentHistory = await response.json();

    if (currentHistory.length === 0) {
      historyContainer.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <p style="font-size: 0.85rem;">No validation records found.</p>
        </div>
      `;
      return;
    }

    historyContainer.innerHTML = '';
    
    currentHistory.forEach(item => {
      const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      let badgeClass = 'badge-verified';
      if (item.status === 'Caution') badgeClass = 'badge-caution';
      if (item.status === 'Critical') badgeClass = 'badge-critical';

      const itemCard = document.createElement('div');
      itemCard.className = 'history-item';
      itemCard.setAttribute('data-id', item._id);
      
      itemCard.innerHTML = `
        <div class="history-info">
          <div class="history-title">${escapeHTML(item.title)}</div>
          <div class="history-meta">
            <span>${dateStr}</span>
            <span class="history-badge ${badgeClass}" style="padding: 0.05rem 0.35rem; font-size: 0.6rem;">${item.status}</span>
          </div>
        </div>
        <button class="history-delete-btn" title="Delete record">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      `;

      // Click to view details
      itemCard.addEventListener('click', (e) => {
        // Prevent trigger if clicking delete button
        if (e.target.closest('.history-delete-btn')) return;
        
        // Hide input form, render details
        document.getElementById('input-section').style.display = 'none';
        document.getElementById('empty-state-section').style.display = 'none';
        renderResults(item);
      });

      // Click to delete
      const deleteBtn = itemCard.querySelector('.history-delete-btn');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete the report for "${item.title}"?`)) {
          await deleteRecord(item._id);
        }
      });

      historyContainer.appendChild(itemCard);
    });

  } catch (error) {
    console.error('History fetch failure:', error);
    historyContainer.innerHTML = `
      <div class="empty-state" style="padding: 2rem 1rem; color: var(--color-danger)">
        <p style="font-size: 0.85rem;">Error loading history.</p>
      </div>
    `;
  }
}

// Delete document record
async function deleteRecord(id) {
  try {
    const response = await fetch(`/api/validate/history/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showToast('Record deleted successfully', 'success');
      
      // If currently showing this record, reset view
      const activeResultId = document.getElementById('result-section').style.display === 'flex' ? 
        currentHistory.find(item => item.title === document.getElementById('result-title').textContent)?._id : null;
      
      if (activeResultId === id) {
        document.getElementById('reset-btn').click();
      }

      await loadHistory();
    } else {
      const data = await response.json();
      showToast(data.message || 'Deletion failed', 'error');
    }
  } catch (error) {
    console.error('Deletion error:', error);
    showToast('Failed to connect to server', 'error');
  }
}
