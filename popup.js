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


    // Set up shortcut input listeners
    const shortcutInput = document.getElementById('threadShortcut');
    shortcutInput.addEventListener('focus', startRecordingShortcut);
    shortcutInput.addEventListener('blur', stopRecordingShortcut);
    
    // Set up reset shortcut button
    document.getElementById('resetShortcut').addEventListener('click', resetShortcutToDefault);
    
    // Load saved shortcut if exists
    const res = await chrome.storage.local.get(['threadShortcut']);
    if (res.threadShortcut) {
      shortcutInput.value = res.threadShortcut;
      updateThreadInstructionText(res.threadShortcut);
    } else {
      // Default shortcut
      shortcutInput.value = 'Ctrl+Shift+Z';
      updateThreadInstructionText('Ctrl+Shift+Z');
    }
  
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
    chrome.storage.local.get(['redmineApiKey'], async (result) => {
      if (result.redmineApiKey) {
        document.getElementById('apiKey').value = result.redmineApiKey;
        
        // Load available statuses for selection
        await loadStatusesForSelection();
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

// Modified initializeExtension function to better handle loading states
function initializeExtension(apiKey, storedIssueId, storedIssueTitle) {
  console.log('Initializing extension');
  // Update user info display
  updateUserInfoDisplay();
  
  // Show loading state
  showLoadingState(true);
  
  // Add this timeout to ensure we detect any hanging loading states
  setTimeout(() => {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator.style.display === 'block') {
      console.warn('Loading indicator still showing after 5 seconds - forcing reset');
      showLoadingState(false);
    }
  }, 5000);
  
  // Fetch available statuses from Redmine API
  fetchIssueStatuses(apiKey).then(() => {
    console.log('Status fetch completed');
    // Check loading state after fetching statuses
    checkLoadingState();
  }).catch(err => {
    console.error('Error fetching statuses:', err);
    // Reset loading state in case of error
    showLoadingState(false);
  });
  
  // Check if we're on an issue page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0].url;
    const issueIdMatch = tabUrl.match(/\/issues\/(\d+)/);
    
    if (issueIdMatch) {
      const currentIssueId = issueIdMatch[1];
      document.getElementById('issueId').value = currentIssueId;
      // Fetch issue details for the current issue
      fetchIssueDetails(currentIssueId, apiKey).then(() => {
        console.log('Issue details fetch completed');
        // Double check loading state
        checkLoadingState();
      });
    } else if (storedIssueId) {
      // Use the stored issue ID if we're not on an issue page
      document.getElementById('issueId').value = storedIssueId;
      
      // Show the stored title if available
      if (storedIssueTitle) {
        updateIssueTitleDisplay(storedIssueId, storedIssueTitle);
      }
      // Fetch current details to get the latest status
      fetchIssueDetails(storedIssueId, apiKey).then(() => {
        console.log('Stored issue details fetch completed');
        // Double check loading state
        checkLoadingState();
      });
    } else {
      // No issue ID available, hide loading state
      console.log('No issue ID available, hiding loading state');
      showLoadingState(false);
    }
  });
  
  // Set up event listeners
  document.getElementById('submit').addEventListener('click', () => {
    console.log('calling functions')
    updateIssueStatus(apiKey);
    updateRemarks(apiKey);
  });
  
  // Add event listener for issue ID input changes
  document.getElementById('issueId').addEventListener('change', (event) => {
    const newIssueId = event.target.value.trim();
    if (newIssueId) {
      showLoadingState(true);
      fetchIssueDetails(newIssueId, apiKey);
    }
  });

  // Restore thread link if it exists
  chrome.storage.local.get(['lastThreadUrl'], (result) => {
    if (result.lastThreadUrl) {
      const threadLink = document.getElementById('threadLink');
      threadLink.href = result.lastThreadUrl;
      threadLink.setAttribute('title', result.lastThreadUrl);
      threadLink.classList.remove('hidden');
      
      // Add click handler to open in new tab
      threadLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: result.lastThreadUrl });
      });
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
  const statusDropdown = document.getElementById('status');
  const issueId = document.getElementById('issueId').value;
  const statusId = document.getElementById('status').value;
  const messageDiv = document.getElementById('message');
  const statusName = statusDropdown.options[statusDropdown.selectedIndex].text;

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
      // Update the status text on the page if we're on a Redmine issue page
      updateStatusOnPage(statusName);
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


// Function to fetch current user details using API key
async function fetchCurrentUser(apiKey) {
  try {
    const response = await fetch('https://redmine.linways.com/users/current.json', {
      method: 'GET',
      headers: {
        'X-Redmine-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const userName = data.user?.firstname + ' ' + data.user?.lastname;
      const userId = data.user?.id;
      
      // Store user details in local storage
      await chrome.storage.local.set({ 
        redmineUserName: userName,
        redmineUserId: userId
      });
      
      return { userName, userId };
    } else {
      console.error('Failed to fetch user details');
      return null;
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
}

// Function to update user info in the UI
function updateUserInfoDisplay() {
  chrome.storage.local.get(['redmineUserName'], (result) => {
    if (result.redmineUserName) {
      // Create or update a user info element
      let userInfoElement = document.getElementById('userInfo');
      if (!userInfoElement) {
        userInfoElement = document.createElement('div');
        userInfoElement.id = 'userInfo';
        userInfoElement.style.fontSize = '12px';
        userInfoElement.style.color = '#666';
        userInfoElement.style.marginBottom = '10px';
        userInfoElement.style.textAlign = 'right';
        
        // Insert after the header
        const headerElement = document.querySelector('h3');
        headerElement.parentNode.insertBefore(userInfoElement, headerElement.nextSibling);
      }
      
      userInfoElement.textContent = `Logged in as: ${result.redmineUserName}`;
    }
  });
}




// Set up keyboard shortcut listener for Ctrl+Shift+Z
document.addEventListener('keydown', function(event) {
  // Check for Ctrl+Shift+Z combination
  if (event.ctrlKey && event.shiftKey && event.key === 'Z') {
    updateThreadLink();
  }
});

// Function to update thread link with current tab URL
async function updateThreadLink() {
  try {
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tabs[0].url;
    
    // Update the thread link
    const threadLink = document.getElementById('threadLink');
    threadLink.href = currentUrl;
    threadLink.setAttribute('title', currentUrl);
    threadLink.classList.remove('hidden');
    
    // Add click handler to open in new tab
    threadLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: currentUrl });
    });
    
    // Save the URL to storage for persistence
    chrome.storage.local.set({ lastThreadUrl: currentUrl });
    
    // Show a message
    document.getElementById('message').textContent = 'Thread URL captured!';
    document.getElementById('message').style.color = 'green';
    
    // Clear message after 2 seconds
    setTimeout(() => {
      document.getElementById('message').textContent = '';
    }, 2000);
  } catch (error) {
    console.error('Error updating thread link:', error);
    document.getElementById('message').textContent = 'Failed to capture thread URL.';
    document.getElementById('message').style.color = 'red';
  }
}



// Variables to track shortcut recording
let isRecordingShortcut = false;
let currentModifiers = [];
let currentKey = '';

// Function to start recording keyboard shortcut
function startRecordingShortcut() {
  isRecordingShortcut = true;
  currentModifiers = [];
  currentKey = '';
  
  const shortcutInput = document.getElementById('threadShortcut');
  shortcutInput.value = 'Press keys...';
  shortcutInput.style.backgroundColor = '#e8f4fc';
  
  // Add one-time keyboard event listener
  document.addEventListener('keydown', recordShortcut);
}

// Function to stop recording keyboard shortcut
function stopRecordingShortcut() {
  isRecordingShortcut = false;
  document.removeEventListener('keydown', recordShortcut);
  
  const shortcutInput = document.getElementById('threadShortcut');
  shortcutInput.style.backgroundColor = '';
}

// Function to record keyboard shortcut
function recordShortcut(event) {
  event.preventDefault();
  
  // Check if it's a modifier key
  if (event.key === 'Control' || event.key === 'Shift' || event.key === 'Alt') {
    if (!currentModifiers.includes(event.key)) {
      currentModifiers.push(event.key);
    }
  } else {
    // It's a regular key
    currentKey = event.key;
  }
  
  // Update the input field
  const shortcutInput = document.getElementById('threadShortcut');
  
  if (currentModifiers.length > 0 && currentKey) {
    // We have both modifiers and a key
    const shortcutString = currentModifiers.join('+') + '+' + currentKey;
    shortcutInput.value = shortcutString;
    
    // Save the shortcut
    chrome.storage.local.set({ threadShortcut: shortcutString });
    
    // Update instruction text
    updateThreadInstructionText(shortcutString);
    
    // Stop recording
    stopRecordingShortcut();
    shortcutInput.blur();
  } else if (currentModifiers.length > 0) {
    // Only modifiers so far
    shortcutInput.value = currentModifiers.join('+') + '+...';
  } else if (currentKey) {
    // Only a key (not recommended but possible)
    shortcutInput.value = currentKey;
    
    // Save the shortcut
    chrome.storage.local.set({ threadShortcut: currentKey });
    
    // Update instruction text
    updateThreadInstructionText(currentKey);
    
    // Stop recording
    stopRecordingShortcut();
    shortcutInput.blur();
  }
}

// Function to reset shortcut to default
function resetShortcutToDefault() {
  const defaultShortcut = 'Ctrl+Shift+Z';
  const shortcutInput = document.getElementById('threadShortcut');
  shortcutInput.value = defaultShortcut;
  
  // Save the default shortcut
  chrome.storage.local.set({ threadShortcut: defaultShortcut });
  
  // Update instruction text
  updateThreadInstructionText(defaultShortcut);
}

// Function to update the thread instruction text
function updateThreadInstructionText(shortcut) {
  const instructionElement = document.querySelector('.thread-instruction');
  if (instructionElement) {
    instructionElement.innerHTML = `Press <kbd>${shortcut}</kbd> to capture current tab URL as Thread`;
  }
}

// Function to check if the pressed keys match the custom shortcut
function checkCustomShortcut(event) {
  chrome.storage.local.get(['threadShortcut'], (result) => {
    const savedShortcut = result.threadShortcut || 'Ctrl+Shift+Z';
    const parts = savedShortcut.split('+');
    
    // Check if all parts of the shortcut are pressed
    let allPartsPressed = true;
    
    for (const part of parts) {
      if (part === 'Ctrl' && !event.ctrlKey) allPartsPressed = false;
      if (part === 'Control' && !event.ctrlKey) allPartsPressed = false;
      if (part === 'Shift' && !event.shiftKey) allPartsPressed = false;
      if (part === 'Alt' && !event.altKey) allPartsPressed = false;
      if (part !== 'Ctrl' && part !== 'Control' && part !== 'Shift' && part !== 'Alt') {
        if (event.key !== part) allPartsPressed = false;
      }
    }
    
    if (allPartsPressed) {
      updateThreadLink();
    }
  });
}

// Update existing keyboard event listener to use the custom shortcut
document.addEventListener('keydown', checkCustomShortcut);


// Function to save API key and settings
async function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const shortcut = document.getElementById('threadShortcut').value.trim();
  const messageDiv = document.getElementById('message');
  
  if (!apiKey) {
    messageDiv.textContent = 'Please enter a valid API key.';
    messageDiv.style.color = 'red';
    return;
  }
  
  // Show loading state
  messageDiv.textContent = 'Verifying API key...';
  messageDiv.style.color = 'blue';
  
  // Try to fetch user details to verify the API key is valid
  const userDetails = await fetchCurrentUser(apiKey);
  
  if (!userDetails) {
    messageDiv.textContent = 'Invalid API key. Could not retrieve user details.';
    messageDiv.style.color = 'red';
    return;
  }
  
  // Save the selected statuses first
  await saveSelectedStatuses();
  
  // Save the API key and shortcut
  await chrome.storage.local.set({ 
    redmineApiKey: apiKey,
    threadShortcut: shortcut 
  });
  
  // Update the instruction text with the new shortcut
  updateThreadInstructionText(shortcut);
  
  // Hide settings and show main content
  document.getElementById('apiKeyContainer').style.display = 'none';
  document.getElementById('apiKeyNotSet').classList.add('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
  
  messageDiv.textContent = `Settings saved successfully! Welcome, ${userDetails.userName}!`;
  messageDiv.style.color = 'green';
  
  // Reload the extension functionality with the new key
  const result = await chrome.storage.local.get(['lastIssueId', 'lastIssueTitle']);
  initializeExtension(apiKey, result.lastIssueId, result.lastIssueTitle);
}

// Helper function to populate the status dropdown
function populateStatusDropdown(dropdown, statuses) {
  // Clear the dropdown
  dropdown.innerHTML = '';
  
  // Add each status as an option
  statuses.forEach(status => {
    const option = document.createElement('option');
    option.value = status.id;
    option.textContent = status.name;
    dropdown.appendChild(option);
  });
}


async function updateStatusOnPage(statusName) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("Current tab:", tab);
    
    // Check if we're on a Redmine issue page
    if (tab.url.includes('/issues/')) {
      try {
        console.log("Sending message to tab:", tab.id);
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "updateIssueStatus",
          statusName: statusName
        });
        console.log("Response:", response);
        return response?.success || false;
      } catch (messageError) {
        console.error("Message sending error:", messageError);
        return false;
      }
    } else {
      console.log("Not on an issue page:", tab.url);
      return false;
    }
  } catch (err) {
    console.error("Error in updateStatusOnPage:", err);
    return false;
  }
}



// Modified fetchIssueStatuses function to properly handle loading states
async function fetchIssueStatuses(apiKey) {
  console.log('Starting fetchIssueStatuses');
  const url = 'https://redmine.linways.com/issue_statuses.json';
  const statusDropdown = document.getElementById('status');
  
  try {
    // First check if we already have stored statuses
    const storedData = await chrome.storage.local.get(['redmineStatuses', 'selectedStatusIds']);
    const allStatuses = storedData.redmineStatuses || [];
    const selectedStatusIds = storedData.selectedStatusIds || [];
    
    console.log('Stored statuses:', allStatuses);
    console.log('Selected status IDs:', selectedStatusIds);
    
    if (allStatuses.length > 0) {
      // Determine which statuses to show - all or filtered
      let statusesToShow = allStatuses;
      
      if (selectedStatusIds.length > 0) {
        // Filter statuses based on selected IDs
        statusesToShow = allStatuses.filter(status => 
          selectedStatusIds.includes(parseInt(status.id))
        );
      }
      
      console.log('Statuses to show in dropdown:', statusesToShow);
      
      // Populate the dropdown with the appropriate statuses
      populateStatusDropdown(statusDropdown, statusesToShow);
      
      // Make sure to show the dropdown and hide loading indicator
      statusDropdown.style.display = 'block';
      document.getElementById('loadingIndicator').style.display = 'none';
      document.getElementById('submit').disabled = false;
      
      return;
    }
    
    // If no stored statuses, fetch from API
    console.log('No stored statuses, fetching from API');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Redmine-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Process and store statuses if API returns data
      if (data.issue_statuses && data.issue_statuses.length > 0) {
        // Format statuses for storage
        const formattedStatuses = data.issue_statuses.map(status => ({
          id: status.id,
          name: status.name
        }));
        
        // Store statuses for future use
        await chrome.storage.local.set({ redmineStatuses: formattedStatuses });
        console.log('Stored new statuses from API:', formattedStatuses);
        
        // Populate dropdown with all statuses (first time)
        populateStatusDropdown(statusDropdown, formattedStatuses);
      } else {
        console.error('No statuses returned from API');
        statusDropdown.innerHTML = '<option value="">No statuses available</option>';
      }
    } else {
      console.error('Failed to fetch issue statuses:', response.status, response.statusText);
      statusDropdown.innerHTML = '<option value="">Failed to load statuses</option>';
    }
    
    // Always ensure we hide the loading indicator and show the dropdown
    statusDropdown.style.display = 'block';
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('submit').disabled = false;
    
  } catch (error) {
    console.error('Error in fetchIssueStatuses:', error);
    statusDropdown.innerHTML = '<option value="">Error loading statuses</option>';
    
    // Ensure loading state is reset even on error
    statusDropdown.style.display = 'block';
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('submit').disabled = false;
  }
}

// Modified saveSelectedStatuses function with better error handling
async function saveSelectedStatuses() {
  try {
    // Collect selected status IDs
    const selectedCheckboxes = document.querySelectorAll('#statusCheckboxes input[type="checkbox"]:checked');
    console.log('Selected checkboxes:', selectedCheckboxes.length);
    
    const selectedStatusIds = Array.from(selectedCheckboxes)
      .map(checkbox => parseInt(checkbox.dataset.statusId || checkbox.value));
    
    console.log('Saving selected status IDs:', selectedStatusIds);
    
    // Save to storage
    await chrome.storage.local.set({ selectedStatusIds: selectedStatusIds });
    console.log('Selected status IDs saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving selected status IDs:', error);
    return false;
  }
}

// Add this function to your popup.js
function checkLoadingState() {
  const statusDropdown = document.getElementById('status');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const submitButton = document.getElementById('submit');
  
  console.log('Current UI State:');
  console.log('- Status Dropdown display:', statusDropdown.style.display);
  console.log('- Loading Indicator display:', loadingIndicator.style.display);
  console.log('- Submit Button disabled:', submitButton.disabled);
  console.log('- Status Dropdown options count:', statusDropdown.options.length);
}