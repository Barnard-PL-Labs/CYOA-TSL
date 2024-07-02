document.getElementById('choice1').addEventListener("click", getNextPassage);
document.getElementById('choice2').addEventListener("click", getNextPassage);
document.getElementById('restart').addEventListener("click", restart);
document.getElementById('submitAPIKey').addEventListener("click", recordKey);
document.getElementById('submitButton').addEventListener("click", function() {
  var dropdown = document.getElementById('myDropdown');
  selectedModel = dropdown.value;
});

// list of all passages for summarization
let passages = [];
let preds = [];
// global variable for the current passage of each time step
let passage;
let storySummary = ""
var apiKey = "";

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

// PREDICATE SPECIFIC
// compute all predicates ahead of time
async function getPreds() {
  return await Promise.all([
    checkObstacle("cave"),
    checkObstacle("market"),
    checkObstacle("town"),
  ]);
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
    { role: "system", content: "You are writing a choose your own adventure book. Given the passage, give a single next concrete action for the player, such as walking to the left. Refer to the reader as `You` and use the present active tense. Do not prefix options with numbers. Do not use the word `can`. Do not use the word `or`. The choice must be a completely different concrete action from: `" + choice1 + "`." }, //maybe ask for different kinds of options here - as mediated by TSL?
    { role: "user", content: nextPassage },
  ];

  await openAIFetchAPI(choice2Prompt, 1, ".").then(userChoice => {
    document.getElementById('choice2').innerHTML = userChoice[0].message.content + ".";
  });
}

async function getNextPassage() {
  intro = document.getElementById('adventureText').innerHTML.trim()
  document.getElementById('adventureText').innerHTML = "<img src=\"walk.gif\"></img>";
  console.log(this.innerHTML)
  let passagePrompt = [
    { role: "system", content: "You are writing a choose your own adventure book. Compose a one paragraph-long passage of the story of at most 100 words. The paragraph should end just before a critical choice. Do not specify choices. Write in the present tense." },
    { role: "assistant", content: storySummary + " " + passage },
    { role: "user", content: this.innerHTML.replace("You", "I") },
  ];

  // dont enter the automaton until the first round is over
  if (firstRound(intro)) {
    passagePrompt[0].content += " Compose the introductory passage of the story which describes the character and the setting. The initial setting can not be in a market, town, or cave."
    await openAIFetchAPI(passagePrompt, 1, "\n").then(newText => {
      passage = newText[0].message.content;
      document.getElementById('adventureText').innerHTML = "";
      console.log("next passage: " + passage)
      document.getElementById('log').innerHTML += (this.innerHTML + "<br><br>" + passage + "<br><br>");
      updateSummary(passage).then(summary => {
        storySummary = summary;
        getChoices(passage)
      });
    });
  }
  else {
      // PREDICATE SPECIFIC
      // -----------------
      let preds = await getPreds();
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

      // TSL synthesized automaton
      updateState();

      console.log(passageTarget)
      if (passageTarget == "toCave") {
        console.log("TSL says go to cave")
        passage = await obstacle(storySummary, choice, "cave")
      }
      else if (passageTarget == "toMarket") {
        console.log("TSL says go to market")
        passage = await obstacle(storySummary, choice, "market")
      }
      else if (passageTarget == "toTown") {
        console.log("TSL says go to town")
        passage = await obstacle(storySummary, choice, "town")
      }
      // -----------------

      // update story summary 
      document.getElementById('adventureText').innerHTML = "";
      document.getElementById('log').innerHTML += (this.innerHTML + "<br><br>" + passage + "<br><br>");
      await updateSummary(passage).then(summary => {
        storySummary = summary;
        console.log("Current state: " + currentState);
        console.log("Generated passage: " + passage);
        console.log("Updated summary: " + storySummary);
        getChoices(passage)
      });
  }
}

function restart() {
  document.getElementById('adventureText').innerHTML = "Once upon a time...";
  document.getElementById('log').innerHTML = "";
  document.getElementById('choice1').innerHTML = "Start the adventure!";
  document.getElementById('choice2').innerHTML = "";

  passages = [];
  preds = [];
  storySummary = "";
  currentState = 0;
  passage = "";
  currentState = 0;

  //PREDICATE SPECIFIC
  // -----------------
  document.getElementById('caveCheck').checked = false;
  document.getElementById('marketCheck').checked = false;
  document.getElementById('townCheck').checked = false;

  passageTarget = "toMarket";

  toCave = "toCave";
  toMarket = "toMarket";
  toTown = "toTown";

  inCave = undefined;
  inMarket = undefined;
  inTown = undefined;
  // -----------------
}

async function openAIFetchAPI(promptMessages, numChoices, stopChars) {
  console.log("Calling " + selectedModel + " API...")
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