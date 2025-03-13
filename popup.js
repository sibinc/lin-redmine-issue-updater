document.addEventListener('DOMContentLoaded', async () => {
  // First check if we have an API key stored
  const result = await chrome.storage.local.get(['redmineApiKey', 'lastIssueId', 'lastIssueTitle']);
  const storedApiKey = result.redmineApiKey;
  
  // Set up settings icon click handler
  document.getElementById('settingsIcon').addEventListener('click', toggleApiKeySettings);
  document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
  document.getElementById('cancelApiKey').addEventListener('click', toggleApiKeySettings);
  document.getElementById('showApiKeyInput').addEventListener('click', () => {
    document.getElementById('apiKeyNotSet').classList.add('hidden');
    document.getElementById('apiKeyContainer').style.display = 'block';
  });
  
  // Set up clipboard copy button
  document.getElementById('copyToClipboard').addEventListener('click', copyIssueIdToClipboard);
  
  // Check if API key is set and handle appropriately
  if (!storedApiKey) {
    // No API key, show the setup prompt
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('apiKeyNotSet').classList.remove('hidden');
    return;
  }
  
  // API key is set, proceed with normal initialization
  initializeExtension(storedApiKey, result.lastIssueId, result.lastIssueTitle);
});

// Function to toggle API key settings visibility
function toggleApiKeySettings() {
  const apiKeyContainer = document.getElementById('apiKeyContainer');
  
  if (apiKeyContainer.style.display === 'block') {
    apiKeyContainer.style.display = 'none';
  } else {
    // Load current API key if it exists
    chrome.storage.local.get(['redmineApiKey'], (result) => {
      if (result.redmineApiKey) {
        document.getElementById('apiKey').value = result.redmineApiKey;
      }
    });
    apiKeyContainer.style.display = 'block';
  }
}

// Function to copy Issue ID to clipboard
function copyIssueIdToClipboard() {
  const issueIdInput = document.getElementById('issueId');
  const issueId = issueIdInput.value.trim();
  
  if (issueId) {
    // Use navigator.clipboard API to copy text
    navigator.clipboard.writeText(issueId).then(() => {
      // Show success tooltip
      const tooltip = document.getElementById('copyTooltip');
      const copyBtn = document.getElementById('copyToClipboard');
      
      // Position the tooltip relative to the button
      const btnRect = copyBtn.getBoundingClientRect();
      tooltip.style.top = `${btnRect.top - 30}px`;
      tooltip.style.left = `${btnRect.left - 10}px`;
      
      // Show tooltip
      tooltip.style.display = 'block';
      
      // Hide tooltip after 1.5 seconds
      setTimeout(() => {
        tooltip.style.display = 'none';
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      document.getElementById('message').textContent = 'Failed to copy to clipboard.';
      document.getElementById('message').style.color = 'red';
    });
  } else {
    document.getElementById('message').textContent = 'No Issue ID to copy.';
    document.getElementById('message').style.color = 'orange';
  }
}

// Function to save API key
async function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiKey) {
    document.getElementById('message').textContent = 'Please enter a valid API key.';
    document.getElementById('message').style.color = 'red';
    return;
  }
  
  // Save the API key
  await chrome.storage.local.set({ redmineApiKey: apiKey });
  
  // Hide settings and show main content
  document.getElementById('apiKeyContainer').style.display = 'none';
  document.getElementById('apiKeyNotSet').classList.add('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
  
  document.getElementById('message').textContent = 'API key saved successfully!';
  document.getElementById('message').style.color = 'green';
  
  // Reload the extension functionality with the new key
  const result = await chrome.storage.local.get(['lastIssueId', 'lastIssueTitle']);
  initializeExtension(apiKey, result.lastIssueId, result.lastIssueTitle);
}

// Main initialization function
function initializeExtension(apiKey, storedIssueId, storedIssueTitle) {
  // Show loading state
  showLoadingState(true);
  
  // Check if we're on an issue page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0].url;
    const issueIdMatch = tabUrl.match(/\/issues\/(\d+)/);
    
    if (issueIdMatch) {
      const currentIssueId = issueIdMatch[1];
      document.getElementById('issueId').value = currentIssueId;
      // Fetch issue details for the current issue
      fetchIssueDetails(currentIssueId, apiKey);
    } else if (storedIssueId) {
      // Use the stored issue ID if we're not on an issue page
      document.getElementById('issueId').value = storedIssueId;
      
      // Show the stored title if available
      if (storedIssueTitle) {
        updateIssueTitleDisplay(storedIssueId, storedIssueTitle);
      }
      // Fetch current details to get the latest status
      fetchIssueDetails(storedIssueId, apiKey);
    } else {
      // No issue ID available, hide loading state
      showLoadingState(false);
    }
  });
  
  // Set up event listeners
  document.getElementById('submit').addEventListener('click', () => {
    updateIssueStatus(apiKey);
  });
  
  // Add event listener for issue ID input changes
  document.getElementById('issueId').addEventListener('change', (event) => {
    const newIssueId = event.target.value.trim();
    if (newIssueId) {
      showLoadingState(true);
      fetchIssueDetails(newIssueId, apiKey);
    }
  });
}

// Function to show/hide loading state
function showLoadingState(isLoading) {
  const statusDropdown = document.getElementById('status');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const submitButton = document.getElementById('submit');
  
  if (isLoading) {
    statusDropdown.style.display = 'none';
    loadingIndicator.style.display = 'block';
    submitButton.disabled = true;
  } else {
    statusDropdown.style.display = 'block';
    loadingIndicator.style.display = 'none';
    submitButton.disabled = false;
  }
}

// Function to fetch issue details including title and status
async function fetchIssueDetails(issueId, apiKey) {
  if (!issueId) {
    showLoadingState(false);
    return;
  }
  
  const url = `https://redmine.linways.com/issues/${issueId}.json`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Redmine-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const issueTitle = data.issue?.subject || 'Unknown Issue';
      const currentStatusId = data.issue?.status?.id;
      
      // Store the title for future use
      chrome.storage.local.set({ 
        lastIssueId: issueId,
        lastIssueTitle: issueTitle 
      });
      
      // Update the UI with the title
      updateIssueTitleDisplay(issueId, issueTitle);
      
      // Set the current status in the dropdown
      if (currentStatusId) {
        setSelectedStatus(currentStatusId);
      }
      
      // Hide loading state after everything is set
      showLoadingState(false);
    } else {
      // Check if it's an API key issue
      if (response.status === 401) {
        document.getElementById('message').textContent = 'Invalid API key. Please update your API key in settings.';
        document.getElementById('message').style.color = 'red';
        document.getElementById('mainContent').classList.add('hidden');
        document.getElementById('apiKeyNotSet').classList.remove('hidden');
      } else {
        updateIssueTitleDisplay(issueId, 'Unable to fetch details');
      }
      showLoadingState(false);
    }
  } catch (error) {
    console.error('Error fetching issue details:', error);
    updateIssueTitleDisplay(issueId, 'Error fetching details');
    showLoadingState(false);
  }
}

// Update the title display in the UI as a clickable link
function updateIssueTitleDisplay(issueId, title) {
  const titleElement = document.getElementById('issueTitle');
  if (titleElement) {
    // Create an anchor element for the clickable title
    titleElement.innerHTML = '';
    const issueLink = document.createElement('a');
    issueLink.href = `https://redmine.linways.com/issues/${issueId}`;
    issueLink.textContent = `#${issueId}: ${title}`;
    issueLink.title = title; // Add title attribute for tooltip on hover
    
    // Add click handler to open in new tab
    issueLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: issueLink.href });
    });
    
    titleElement.appendChild(issueLink);
    titleElement.style.display = 'block';
  }
}

// Set the selected status in the dropdown
function setSelectedStatus(statusId) {
  const statusDropdown = document.getElementById('status');
  const statusOption = statusDropdown.querySelector(`option[value="${statusId}"]`);
  
  if (statusOption) {
    statusOption.selected = true;
  }
}

// Function to update the issue status
async function updateIssueStatus(apiKey) {
  const issueId = document.getElementById('issueId').value;
  const statusId = document.getElementById('status').value;
  const messageDiv = document.getElementById('message');

  if (!issueId) {
    messageDiv.textContent = 'Please enter an Issue ID.';
    messageDiv.style.color = 'red';
    return;
  }

  // Show loading state while updating
  showLoadingState(true);
  
  const url = `https://redmine.linways.com/issues/${issueId}.json`;

  const requestOptions = {
    method: 'PUT',
    headers: {
      'X-Redmine-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      issue: {
        status_id: parseInt(statusId)
      }
    })
  };

  try {
    const response = await fetch(url, requestOptions);
    if (response.ok) {
      messageDiv.textContent = 'Issue status updated successfully!';
      messageDiv.style.color = 'green';
      
      // Refresh issue details after successful update
      fetchIssueDetails(issueId, apiKey);
    } else {
      // Check if it's an API key issue
      if (response.status === 401) {
        messageDiv.textContent = 'Invalid API key. Please update your API key in settings.';
        messageDiv.style.color = 'red';
        document.getElementById('mainContent').classList.add('hidden');
        document.getElementById('apiKeyNotSet').classList.remove('hidden');
      } else {
        const errorData = await response.json();
        messageDiv.textContent = `Error: ${errorData.errors ? errorData.errors.join(', ') : 'Unknown error'}`;
        messageDiv.style.color = 'red';
      }
      showLoadingState(false);
    }
  } catch (error) {
    messageDiv.textContent = `Error: ${error.message}`;
    messageDiv.style.color = 'red';
    showLoadingState(false);
  }
}
