async function updateRemarks(apiKey) {
    const remark = document.getElementById("remark").value.trim();
    const messageDiv = document.getElementById("message");

    if (!remark) {
        messageDiv.textContent = "Please enter a remark!";
        messageDiv.style.color = "red";
        return;
    }

    try {
        // Await the user details before proceeding
        const user = await fetchCurrentUser(apiKey);

        if (!user) {
            messageDiv.textContent = "Failed to fetch user details!";
            messageDiv.style.color = "red";
            return;
        }

        const apiUrl = "https://redmine-remarks-api-production.up.railway.app/submit-remark";

        const data = {
            userId: user.userId,        
            userName: user.userName,    
            remark: remark
        };

        console.log("Payload:", data);

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const result = await response.json();
            messageDiv.textContent = "Remark submitted successfully!";
            messageDiv.style.color = "green";
            document.getElementById("remark").value = "";  // Clear the textarea
        } else {
            const errorResult = await response.json();
            messageDiv.textContent = `Error: ${errorResult.detail || "Unknown error"}`;
            messageDiv.style.color = "red";
        }
    } catch (error) {
        console.error("Error:", error);
        messageDiv.textContent = "Failed to submit remark.";
        messageDiv.style.color = "red";
    }
}
