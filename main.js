document.getElementById('submitAPIKey').addEventListener("click", recordKey);
document.getElementById('choice1').addEventListener("click", getNextPassageAndChoices);
document.getElementById('choice2').addEventListener("click", getNextPassageAndChoices);
document.getElementById('restart').addEventListener("click", restart);

// list of all passages for summarization
let passages = []
// global variable for the current passage of each time step
let passage;
let passageTarget = "toMarket";
let currentText;
storySummary = ""
const numPassagesToConsider = 3;

// compute all predicates ahead of time
async function getPreds(choice) {
  let preds = await Promise.all([
    checkInCave(storySummary),
    checkInMarket(storySummary),
    checkInTown(storySummary),
  ]);
  return preds;
}

var apiKey = "";
var selectedModel = "gpt-3.5-turbo-1106";

function recordKey() {
  // Get the value entered in the text input
  apiKey = document.getElementById("input_APIKey").value;
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('submitButton').addEventListener('click', function () {
    var dropdown = document.getElementById('myDropdown');
    selectedModel = dropdown.value;
  });
});

function firstRound(currentText) {
  return currentText == "Once upon a time..."
}

function restart() {
  document.getElementById('adventureText').innerHTML = "Once upon a time...";
  document.getElementById('choice1').innerHTML = "Start your adventure!";
  document.getElementById('choice2').innerHTML = "";
  document.getElementById('log').innerHTML = "";
  document.getElementById('caveCheck').checked = false;
  document.getElementById('marketCheck').checked = false;
  document.getElementById('townCheck').checked = false;

  currentText = "";
  passages = [];
  storySummary = "";
  currentState = 0;
  passage = "";
  passageTarget = "toMarket";

  toCave = "toCave";
  toMarket = "toMarket";
  toTown = "toTown";

  inCave = undefined;
  inMarket = undefined;
  inTown = undefined;
}

async function getChoices(nextPassage) {
  let choice1Prompt = [
    { role: "system", content: "You are writing a choose your own adventure book. Given the passage, give a single next concrete action for the player, such as walking to the left. Refer to the reader as `You` and use the present active tense. Do not prefix options with numbers. Do not use the word `can`. Do not use the word `or`" }, //maybe ask for different kinds of options here - as mediated by TSL?
    { role: "user", content: nextPassage },
  ];
  let choice1;
  await openAIFetchAPI(choice1Prompt, 1, ".").then(userChoice => {
    document.getElementById('choice1').innerHTML = userChoice[0].message.content + ".";
    choice1 = userChoice[0].message.content + ".";
  })

  let choice2Prompt = [
    { role: "system", content: "You are writing a choose your own adventure book. Given the passage, give a single next concrete action for the player, such as walking to the left. Refer to the reader as `You` and use the present active tense. Do not prefix options with numbers. Do not use the word `can`. Do not use the word `or`. The choice must be a different concrete action from: `" + choice1 + "`." }, //maybe ask for different kinds of options here - as mediated by TSL?
    { role: "user", content: nextPassage },
  ];

  await openAIFetchAPI(choice2Prompt, 1, ".").then(userChoice => {
    document.getElementById('choice2').innerHTML = userChoice[0].message.content + ".";
  });
}

async function getNextPassageAndChoices() {
  currentText = document.getElementById('adventureText').innerHTML.trim();
  document.getElementById('adventureText').innerHTML = "<img src=\"walk.gif\"></img>";
  let passagePrompt = [
    { role: "system", content: "You are writing a choose your own adventure book. Compose a one paragraph-long passage of the story of at most 100 words. The paragraph should end just before a critical choice. Do not specify choices. Write in the present tense." },
    { role: "assistant", content: storySummary + " " + currentText },
    { role: "user", content: this.innerHTML.replace("You", "I") },
  ];

  // dont enter the automaton until the first round is over
  if (firstRound(currentText)) {
    console.log("first round")
    passagePrompt[0].content += " Compose the introductory passage of the story which describes the character and the setting. "
    //"The initial setting can not be in a market, town, or cave."
    openAIFetchAPI(passagePrompt, 1, "\n").then(newText => {
      passage = newText[0].message.content;
      document.getElementById('adventureText').innerHTML = passage;
      console.log("next passage: " + currentText)
      document.getElementById('log').innerHTML += (this.innerHTML + "<br><br>" + passage + "<br><br>");
      updateSummary(passage).then(summary => {
        storySummary = summary;
        getChoices(passage)
      });
    });
  }
  else {
    // compute all predicates ahead of time for the sake of efficiency and money
    getPreds(this.innerHTML.replace("You", "I")).then(async preds => {
      inCave = preds[0];
      inMarket = preds[1];
      inTown = preds[2];

      console.log("inCave: " + inCave);
      console.log("inMarket: " + inMarket);
      console.log("inTown: " + inTown);

      // keep track if market and town were visited before cave
      if (inCave) {
        document.getElementById("caveCheck").checked = true;
      }
      if (inMarket) {
        document.getElementById("marketCheck").checked = true;
      }
      if (inTown) {
        document.getElementById("townCheck").checked = true;
      }

      let choice = this.innerHTML.replace("You", "I")

      // TSL automaton
      updateState();
      console.log(passageTarget)
      if (passageTarget == "toCave") {
        console.log("TSL says go to cave")
        passage = await cave(storySummary, choice)
      }
      else if (passageTarget == "toMarket") {
        console.log("TSL says go to market")
        passage = await market(storySummary, choice)
      }
      else if (passageTarget == "toTown") {
        console.log("TSL says go to town")
        passage = await town(storySummary, choice)
      }

      // update story summary and choices
      document.getElementById('adventureText').innerHTML = passage;
      document.getElementById('log').innerHTML += (this.innerHTML + "<br><br>" + passage + "<br><br>");
      updateSummary(passage).then(summary => {
        storySummary = summary;
        console.log("Current state: " + currentState);
        console.log("Generated passage: " + passage);
        console.log("Updated summary: " + storySummary);
        getChoices(passage)
      });
    });
  }
}

async function openAIFetchAPI(promptMessages, numChoices, stopChars) {
  console.log("Calling GPT3")
  const url = "https://api.openai.com/v1/chat/completions";
  const YOUR_TOKEN = apiKey //add your own openai api key
  const bearer = 'Bearer ' + YOUR_TOKEN
  const data = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': bearer,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "model": selectedModel,
      "messages": promptMessages,
      "max_tokens": 250,
      "temperature": 1,
      "top_p": 1,
      "n": numChoices,
      "stream": false,
      "stop": stopChars
    })
  }).then(response => {
    return response.json()
  });
  return data['choices'];
}
