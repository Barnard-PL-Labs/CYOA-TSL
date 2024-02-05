const numPassagesToConsider = 3;

let genericPrompt = "You are writing a choose your own adventure book. Compose a one paragraph-long passage of the story of at most 200 words. The paragraph should end just before a critical choice. Do not specify choices. Write in the present tense and never use the first-person."

async function obstacle(summary, choice, obstacle) {
  console.log("getting " + obstacle + " passage...");
  let specificPrompt = " Compose a passage where the reader encounters a " + obstacle + " on their journey.";
  let passagePrompt = [
    { role: "system", content: genericPrompt + specificPrompt },
    { role: "assistant", content: summary + " " + passage },
    { role: "user", content: choice },
  ];
  return await getAPIResponse(passagePrompt, false);
}

//TSL predicates
async function checkObstacle(obstacle) {
  console.log("checking if in " + obstacle + "...");
  let passagePrompt = [
    { role: "system", content: "Read this passage in an adventure story. Is the main character actively in a " + obstacle + " or not? Respond '0' if it is false, or '1' if it is true." },
    { role: "user", content: passage },
  ];
  return await getAPIResponse(passagePrompt, true)
}

async function updateSummary(previousSummary) {
  passages.push(previousSummary);
  let summaryPrompt = [
    { role: "system", content: "You are writing a book and need to recall important points of the story so far. Summarize the provided passage from about the story so far in moderate detail, including the main character description, the locations visited, items  acquired, and interactions with other characters. Specifically, make sure to include if the player has visited a town, a market, or a cave." }, //maybe ask for different kinds of options here - as mediated by TSL?
    { role: "user", content: passages.slice(-numPassagesToConsider).join(' ') },
  ];
  return await getAPIResponse(summaryPrompt, false);
}

async function getAPIResponse(prompt, isPredicate) {
  try {
    let newText = await openAIFetchAPI(prompt, 1, "\n");
    let response = newText[0].message.content;
    if (isPredicate) {
      let pred = response.includes("1");
      return pred;
    }
    else {
      return response;
    }
  } catch (error) {
    console.error("Error determining state:", error);
    return null;
  }
}