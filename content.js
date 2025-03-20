// content.js
console.log("Redmine Issue Updater content script loaded");

// Listen for messages from the extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request);
  
  if (request.action === "updateIssueStatus") {
    try {
      // Target the specific status value element in the Redmine issue page
      const statusElement = document.querySelector('.status.attribute .value');
      
      if (statusElement) {
        // Update the status text with the new status name
        statusElement.textContent = request.statusName;
        
        // Optional: Add a brief highlight effect to indicate the change
        statusElement.style.transition = 'background-color 1s';
        statusElement.style.backgroundColor = '#ffffcc';
        
        setTimeout(() => {
          statusElement.style.backgroundColor = '';
        }, 2000);
        
        sendResponse({ success: true });
      } else {
        console.error("Status element not found on the page");
        sendResponse({ success: false, error: "Status element not found" });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Required for async response
  }
});