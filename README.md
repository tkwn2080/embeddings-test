# embeddings-test: conversational memory via chromadb
This handles a conversation between two agents, Person-A and Person-B.
The pair converse for a set number of turns, per handleConversation(convLength).

Their memory of the conversation is embedded via ChromaDB, with a pool each.
Each incoming message triggers a query, the results of which are then converted to a form amenable to prompt injection.
This basic structure is solid, albeit with limitations.

Testing functions include embedThoughts() and the recursive query function.
The value of these is as yet unclear, contingent.

You will need to point this at a Chroma client, here hosted via Docker.
An OpenAI API key in environmental variables is also necessary.
