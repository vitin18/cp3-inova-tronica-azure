#!/bin/bash
RM="95860"
RESOURCE_GROUP="rg-web-app"
PLAN_NAME="plan-web-app"
APP_NAME="web-app-rm${RM}"
LOCATION="brazilsouth"
RUNTIME="NODE:26"
AOAI_NAME="openai-inova-rm${RM}"

echo "🚀 [1/5] Criando Grupo de Recursos..."
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "📦 [2/5] Criando Plano de Serviço Linux (F1)..."
az appservice plan create --name $PLAN_NAME --resource-group $RESOURCE_GROUP --location $LOCATION --sku F1 --is-linux

echo "🌐 [3/5] Criando Web App..."
az webapp create --name $APP_NAME --resource-group $RESOURCE_GROUP --plan $PLAN_NAME --runtime "$RUNTIME"

echo "🧠 [4/5] Criando Azure OpenAI e modelo GPT-4o..."
az cognitiveservices account create --name $AOAI_NAME --resource-group $RESOURCE_GROUP --location eastus2 --kind OpenAI --sku S0 --custom-domain $AOAI_NAME --yes
az cognitiveservices account deployment create --name $AOAI_NAME --resource-group $RESOURCE_GROUP --deployment-name chat-ia --model-name gpt-4o --model-version "2024-11-20" --model-format OpenAI --sku-capacity 10 --sku-name "Standard"

AOAI_ENDPOINT=$(az cognitiveservices account show --name $AOAI_NAME --resource-group $RESOURCE_GROUP --query "properties.endpoint" -o tsv)
AOAI_KEY=$(az cognitiveservices account keys list --name $AOAI_NAME --resource-group $RESOURCE_GROUP --query "key1" -o tsv)
az webapp config appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP --settings AZURE_OPENAI_ENDPOINT="$AOAI_ENDPOINT" AZURE_OPENAI_KEY="$AOAI_KEY" AZURE_OPENAI_DEPLOYMENT="chat-ia"

echo "☁️ [5/5] Empacotando e fazendo Deploy..."
zip -r app.zip index.js package.json
az webapp deploy --resource-group $RESOURCE_GROUP --name $APP_NAME --src-path app.zip --type zip
