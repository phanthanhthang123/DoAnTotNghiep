#!/bin/sh
echo "Waiting for database to be ready..."

# Run Sequelize migrations
echo "Running database migrations..."
npx sequelize-cli db:migrate

# Start the server
echo "Starting server..."
npx nodemon --exec babel-node server.js
