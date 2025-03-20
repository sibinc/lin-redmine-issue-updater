// status-filter.js - Manages status filtering functionality

// Function to load available statuses for selection in settings
async function loadStatusesForSelection() {
    console.log('Loading statuses for settings panel');
    const statusCheckboxesContainer = document.getElementById('statusCheckboxes');
    statusCheckboxesContainer.innerHTML = '<p style="color: #888; font-style: italic;">Loading available statuses...</p>';
    
    try {
      // Get statuses and selected status IDs from storage
      const storedData = await chrome.storage.local.get(['redmineStatuses', 'selectedStatusIds']);
      const statuses = storedData.redmineStatuses || [];
      const selectedStatusIds = storedData.selectedStatusIds || [];
      
      console.log('Loading statuses for selection:', statuses);
      console.log('Currently selected status IDs:', selectedStatusIds);
      
      // Clear the container
      statusCheckboxesContainer.innerHTML = '';
      
      if (statuses.length === 0) {
        statusCheckboxesContainer.innerHTML = '<p style="color: #f44336;">No statuses available. Please use the extension first to load statuses.</p>';
        return;
      }
      
      // Create checkboxes for each status
      statuses.forEach(status => {
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.style.marginBottom = '8px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `status-${status.id}`;
        checkbox.dataset.statusId = status.id; // Use dataset for reliable access
        
        // Check if this status is selected (or if no selection has been made yet, default to all selected)
        checkbox.checked = selectedStatusIds.length === 0 || 
                           selectedStatusIds.includes(parseInt(status.id));
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = status.name;
        label.style.marginLeft = '5px';
        
        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(label);
        statusCheckboxesContainer.appendChild(checkboxWrapper);
      });
      
      // Add select all/none buttons
      const buttonWrapper = document.createElement('div');
      buttonWrapper.style.marginTop = '10px';
      buttonWrapper.style.display = 'flex';
      buttonWrapper.style.gap = '10px';
      
      const selectAllButton = document.createElement('button');
      selectAllButton.textContent = 'Select All';
      selectAllButton.style.flex = '1';
      selectAllButton.addEventListener('click', () => {
        document.querySelectorAll('#statusCheckboxes input[type="checkbox"]').forEach(cb => {
          cb.checked = true;
        });
      });
      
      const selectNoneButton = document.createElement('button');
      selectNoneButton.textContent = 'Select None';
      selectNoneButton.style.flex = '1';
      selectNoneButton.addEventListener('click', () => {
        document.querySelectorAll('#statusCheckboxes input[type="checkbox"]').forEach(cb => {
          cb.checked = false;
        });
      });
      
      buttonWrapper.appendChild(selectAllButton);
      buttonWrapper.appendChild(selectNoneButton);
      statusCheckboxesContainer.appendChild(buttonWrapper);
    } catch (error) {
      console.error('Error loading statuses for selection:', error);
      statusCheckboxesContainer.innerHTML = `<p style="color: #f44336;">Error loading statuses: ${error.message}</p>`;
    }
  }
  
  // Function to save selected statuses
  function saveSelectedStatuses() {
    // Collect selected status IDs
    const selectedStatusIds = Array.from(
      document.querySelectorAll('#statusCheckboxes input[type="checkbox"]:checked')
    ).map(checkbox => parseInt(checkbox.dataset.statusId));
    
    console.log('Saving selected status IDs:', selectedStatusIds);
    
    // Save to storage
    return chrome.storage.local.set({ selectedStatusIds: selectedStatusIds });
  }
  
  // Function to filter statuses based on selection for the dropdown
  async function getFilteredStatuses() {
    try {
      // Get statuses and selected status IDs from storage
      const storedData = await chrome.storage.local.get(['redmineStatuses', 'selectedStatusIds']);
      const allStatuses = storedData.redmineStatuses || [];
      const selectedStatusIds = storedData.selectedStatusIds || [];
      
      // If no selections have been made yet, return all statuses
      if (selectedStatusIds.length === 0) {
        return allStatuses;
      }
      
      // Filter statuses based on selected IDs
      return allStatuses.filter(status => 
        selectedStatusIds.includes(parseInt(status.id))
      );
    } catch (error) {
      console.error('Error getting filtered statuses:', error);
      return [];
    }
  }