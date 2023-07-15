//DEPENDENCIES
const { Configuration, OpenAIApi } = require("openai");
const moment = require('moment');
const {ChromaClient} = require('chromadb');
const client = new ChromaClient({
  path: "http://localhost:8000"
});

//PREREQUISITES
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  
const {OpenAIEmbeddingFunction} = require('chromadb');
const embedder = new OpenAIEmbeddingFunction({ openai_api_key: process.env.OPENAI_API_KEY });

let collectionA, collectionB;

async function initiateCollection() {
  try {
    // await client.deleteCollection({
    //   name: "memory-a"
    //  });

    // await client.deleteCollection({
    //   name: "memory-b"
    //  });
    
    // collectionA = await client.createCollection({
    //   name: "memory-a",
    //   metadata: {
    //     "description": "conversation memory"
    //   },
    //   embeddingFunction: embedder,
    // });

    // collectionB = await client.createCollection({
    //   name: "memory-b",
    //   metadata: {
    //     "description": "conversation memory"
    //   },
    //   embeddingFunction: embedder,
    // });

    
    collectionA = await client.getCollection({
      name: "memory-a",
      embeddingFunction: embedder,
    });

    collectionB = await client.getCollection({
      name: "memory-b",
      embeddingFunction: embedder,
    });
  } catch (error) {
    console.log(`Error in initiateCollection: ${error}`);
  }
}


async function addMemory(associativeMemory, otherMessage, collectionName, identity1, identity2) {
  try {
    let memoryPrompt = "";

    if (associativeMemory.ids[0].length > 0) {
      memoryPrompt = `Your conversation partner has just said: ${otherMessage}\n\nThis has made you remember the following:\n`;

      associativeMemory.documents[0].forEach((doc, index) => {
        let distance = associativeMemory.distances[0][index];
        let id = associativeMemory.ids[0][index];
        memoryPrompt += `Memory date and time ${id} with semantic distance ${distance}: "${doc}"\n`;
      });

      const response1 = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        // model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `I am the internal memory function of a human named ${identity1}. I am having a conversation with another human, ${identity2}. My role is to take the information that has been drawn to mind from your associative memory and filter it for relevance, then present it to myself in a way that is useful to me. I will speak in such a way that this can be injected smoothly into my inner monologue, that this will be written in the style and perspective of an individual thinking to themselves. I will say, e.g., "I recall that …." If there is nothing to say, I will say nothing. I should note the semantic and temporal distance of each memory, that these will be relevant to understanding them. The current time is ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}.`
          },
          {role: "user", content: `${memoryPrompt}\n\nI will now think through these memories and consider their implications for my behaviour.\n\nIf there is anything that I cannot remember that I would like to remember for myself, then I will state this subject in square brackets like so: [topic/s to try and remember about]. Square brackets are only for prompting my own recollection, not for asking other people.`},
        ],
        temperature: 0.7,
      });
      const completion1 = response1.data.choices[0].message.content;
      memoryPrompt = completion1;

      if (completion1.includes('[')) {
        const toRemember = completion1.substring(
          completion1.lastIndexOf("[") + 1, 
          completion1.lastIndexOf("]")
        );

        let nextMemories;
        
        if (collectionName === "collectionA") {
          nextMemories = await collectionA.query({
            queryTexts: [toRemember],
            nResults: 3,
          });
        } else if (collectionName === "collectionB") {
          nextMemories = await collectionB.query({
            queryTexts: [toRemember],
            nResults: 3,
          });
        }

        nextMemory = ``;

        nextMemories.documents[0].forEach((doc, index) => {
          let distance = nextMemories.distances[0][index];
          let id = nextMemories.ids[0][index];
          nextMemory += `Memory date and time ${id} with semantic distance ${distance}: "${doc}"\n`;
        });

        const response2 = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          // model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `I am the internal memory function of a human named ${identity1}. I am having a conversation with another human, ${identity2}. My role is to take the information that has been drawn to mind from your associative memory and filter it for relevance, then present it to myself in a way that is useful to me. I will speak in such a way that this can be injected smoothly into my inner monologue, that this will be written in the style and perspective of an individual thinking to themselves. I will say, e.g., "I recall that …." If there is nothing to say, I will say nothing. I should note the semantic and temporal distance of each memory, that these will be relevant to understanding them. The current time is ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}.`
            },
            {role: "user", content: `${memoryPrompt}\n\nI will now think through these memories and consider their implications for my behaviour.`},
            {role: "assistant", content: completion1},
            {role: "user", content: `I have just tried to remember about ${toRemember}, and I have recalled the following: ${nextMemory}`}

          ],
          temperature: 0.7,
        });
        const completion2 = response2.data.choices[0].message.content;
        
        memoryPrompt = `${completion1}\n\n${completion2}`;
        embedThoughts(memoryPrompt, collectionName);
      }
    } else {
      embedThoughts(memoryPrompt, collectionName);
      return memoryPrompt;
    }
    return memoryPrompt;
  } 
  catch (error) {
    console.log(`Error in addMemory: ${error}`);
  }
}


async function embedThoughts(thoughts, collectionName) {
  try {
    ID = moment().format();
    ID = ID.toString();

    if (collectionName === "collectionA") {
      await collectionA.add({
        ids: [ID],
        documents: [`Inner Monologue: ${thoughts}`],
      })
    } else if (collectionName === "collectionB") {
      await collectionB.add({
        ids: [ID],
        documents: [`Inner Monologue: ${thoughts}`],
      })
    }
  } catch (error) {
    console.log(`Error in embedThoughts: ${error}`);
  }
}


async function personA(otherMessage) {
  try {
    const associativeMemory = await collectionA.query({
      queryTexts: [otherMessage],
      nResults: 3, 
    });

    memoryPrompt = await addMemory(associativeMemory, otherMessage, "collectionA", "Person-A", "Person-B");
    console.log(`\n\nMEMORY A\n\n${memoryPrompt}`);

    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      // model: "gpt-4",
      messages: [
        {role: "system", content: `I am Person-A, and I am having a conversation with Person-B. ${memoryPrompt}`},
        {role: "user", content: `I have just listened Person-A as they said the following: ${otherMessage}\nNow that I have thought about this I will respond concisely, taking into account as appropriate any recollections of our previous interactions.`},
      ],
      temperature: 0.7,
    });
    completion = response.data.choices[0].message.content;
    console.log(`\n\nPERSON-A\n\n${completion}`);

    ID = moment().format();
    ID = ID.toString();

    await collectionA.add({
      ids: [ID],
      documents: [`Person-B: ${otherMessage}\n\nPerson-A: ${completion}`],
    })

    return completion;
  } catch (error) {
    console.log(`Error in Person A: ${error.message}`);
  }
}


async function personB(otherMessage) {
  try {
    const associativeMemory = await collectionB.query({
      queryTexts: [otherMessage],
      nResults: 3, 
    });

    memoryPrompt = await addMemory(associativeMemory, otherMessage, "collectionB", "Person-B", "Person-A");
    console.log(`\n\nMEMORY B\n\n${memoryPrompt}`);

    response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      // model: "gpt-4",
      messages: [
        {role: "system", content: `I am Person-B, and here I am having a conversation with Person-A. ${memoryPrompt}`},
        {role: "user", content: `I have just listened Person-A as they said the following: ${otherMessage}\nNow that I have thought about this I will respond concisely, taking into account as appropriate any recollections of our previous interactions.`},
      ],
      temperature: 0.7,
    });
    completion = response.data.choices[0].message.content;
    console.log(`\n\nPERSON-B\n\n${completion}`);

    ID = moment().format();
    ID = ID.toString();

    await collectionB.add({
      ids: [ID],
      documents: [`Person-A: ${otherMessage}\n\nPerson-B: ${completion}`],
    })

    return completion;
  } catch (error) {
    console.log(`Error in Person B: ${error.message}`);
  }
}


async function handleConversation(convLength) {
  try {
    await initiateCollection();
    let message = "Hello, how are you?";
    console.log (`\n\nPERSON-B\n\n${message}`);
    const totalMessages = convLength;
    for (let i = 0; i < totalMessages; i++) {
      if (i % 2 == 0) {
        message = await personA(message);
      } else {
        message = await personB(message);
      }
    }
  } catch (error) {
    console.log(`Error in Conversation: ${error}`);
  }
}


handleConversation(5);
