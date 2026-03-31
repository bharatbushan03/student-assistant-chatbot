const form = document.getElementById("chat-form");
const questionInput = document.getElementById("question");
const statusEl = document.getElementById("status");
const answerEl = document.getElementById("answer");
const askBtn = document.getElementById("ask-btn");

function setStatus(message, isError = false) {
	statusEl.textContent = message;
	statusEl.className = isError ? "status error" : "status";
}

async function askQuestion(question) {
	setStatus("Thinking...");
	askBtn.disabled = true;

	try {
		const response = await fetch("/chat/ask", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ question }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(errorText || "Request failed");
		}

		const data = await response.json();
		answerEl.textContent = data.answer || "No answer returned.";
		setStatus("Answer ready");
	} catch (err) {
		answerEl.textContent = "";
		setStatus(err.message || "Something went wrong", true);
	} finally {
		askBtn.disabled = false;
	}
}

form.addEventListener("submit", (event) => {
	event.preventDefault();
	const question = questionInput.value.trim();
	if (!question) {
		setStatus("Please enter a question", true);
		return;
	}
	askQuestion(question);
});
