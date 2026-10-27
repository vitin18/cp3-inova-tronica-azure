# ⚡ Inova Trônica — Portal Cloud Industrial 4.0 & Azure OpenAI (GPT-4o)

![Microsoft Azure](https://img.shields.io/badge/Microsoft_Azure-0089D6?style=for-the-badge&logo=microsoft-azure&logoColor=white)
![Azure CLI](https://img.shields.io/badge/Azure_CLI-IaC_Automation-2563eb?style=for-the-badge&logo=gnubash&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_26-Linux_F1-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Azure OpenAI](https://img.shields.io/badge/Azure_OpenAI-GPT--4o_Live-8b5cf6?style=for-the-badge&logo=openai&logoColor=white)

> **3º Checkpoint — 2º Semestre | Serviços Cognitivos em Nuvem (FIAP)**  
> **Representante:** Vitor — **RM95860** (`RM95860@fiap.com.br`)  
> 🌐 **Aplicação Online no Azure:** [https://web-app-rm95860.azurewebsites.net](https://web-app-rm95860.azurewebsites.net)  
> 📦 **Repositório Oficial:** [https://github.com/vitin18/cp3-inova-tronica-azure](https://github.com/vitin18/cp3-inova-tronica-azure)

---

## 🎯 Sobre o Projeto: Cenário Inova Trônica

A **Inova Trônica** está modernizando sua infraestrutura industrial para disponibilizar suas aplicações de telemetria e diagnóstico cognitivo de forma ágil, escalável e acessível na nuvem.

Este projeto implementa uma solução completa de **Infraestrutura como Código (IaC)** utilizando um único script **Azure CLI (`deploy.sh`)**, que provisiona automaticamente todos os recursos no Microsoft Azure (sem configurações manuais pelo portal) e realiza o deploy de uma plataforma web integrada ao **Azure OpenAI (`GPT-4o`)**.

---

## 🏗️ Arquitetura e Recursos Provisionados na Nuvem

Todos os recursos foram provisionados via linha de comando respeitando as políticas (*Azure Policy*) da assinatura acadêmica:

| Recurso no Azure | Nome Padronizado | Especificação / Camada (SKU) | Região |
| :--- | :--- | :--- | :--- |
| **Grupo de Recursos** | `rg-web-app` | Container lógico da solução | `brazilsouth` |
| **Plano de Serviço de Aplicativo** | `plan-web-app` | Sistema Operacional **Linux** — Camada **F1 (Gratuito)** | `brazilsouth` |
| **Serviço de Aplicativo (Web App)** | `web-app-rm95860` | Runtime **Node.js 26 LTS (`NODE:26`)** | `brazilsouth` |
| **Serviço Cognitivo (Azure OpenAI)** | `openai-inova-rm95860` | Modelo Generativo **`gpt-4o`** (Deployment: `chat-ia`) | `eastus2` |

---

## ✨ Funcionalidades da Solução

### 🔐 1. Autenticação Inteligente e Gestão de Usuários
- **Login Autenticado:** Acesso rápido com credencial padrão (`RM95860@fiap.com.br` / senha: `inova2026`).
- **Criação e Armazenamento de Contas:** Permite cadastrar novos engenheiros/técnicos informando Nome, E-mail/RM, Cargo na Planta e Senha, armazenando os registros no servidor (`/tmp/users.json`) e exibindo chips de preenchimento rápido.
- **Modo Visitante:** Botão de acesso instantâneo (*"Entrar como Visitante"*) para avaliação rápida sem necessidade de senha.

### 📡 2. Monitoramento de Sensores na Planta Industrial
Painel interativo com mapeamento por setor da fábrica e **Mini Gráfico SVG em Tempo Real** da curva histórica de cada dispositivo:

1. **Sensor Nível Radar 80GHz (`RAD-80G-01`)** — *📍 Setor A1: Silo Químico de Resina Epóxi* (Medição contínua sem contato em `78.4%`).
2. **Sensor Fotoelétrico Laser (`FOT-LSR-02`)** — *📍 Setor B2: Esteira de Embalagem* (Contagem óptica em alta velocidade: `1.240 pç/h`).
3. **Sensor Indutivo M18 (`IND-M18-03`)** — *📍 Setor C1: Célula Robótica de Solda* (Detecção magnética de proximidade metálica: `4.2 mm`).
4. **Sensor VisionAI X1 (`VIS-AI-04`)** — *📍 Setor D3: Linha de Montagem SMT* (Inspeção visual de placas PCB com `99.4%` de acurácia).
5. **CLP SmartRelay 4.0 (`CLP-SR-05`)** — *📍 Setor E1: Subestação Térmica* (Monitoramento térmico com detecção de anomalia em `68°C` e calibração remota para `46°C`).
6. **Gateway ESP32-S3 Cloud (`ESP-GW-06`)** — *📍 Setor TI: Rack Central IoT* (Concentrador MQTT conectado ao Azure com latência de `12 ms`).

### 🤖 3. Inova Copilot Integrado ao Azure OpenAI (`GPT-4o`)
- Recebe em tempo real o JSON de telemetria dos 6 sensores da planta industrial.
- Troca automaticamente o sensor em foco e o gráfico na tela conforme o assunto perguntado pelo engenheiro.
- Executa **calibração térmica remota do CLP SmartRelay 4.0** via comando no chat, normalizando a curva de temperatura de **68°C para 46°C** em tempo real.

---

## 📂 Estrutura do Repositório

```text
📦 cp3-inova-tronica-azure
 ┣ 📜 deploy.sh      # Script Azure CLI que provisiona a infraestrutura e realiza o deploy
 ┣ 📜 index.js       # Servidor Node.js, interface web, gráficos SVG e integração Azure OpenAI
 ┣ 📜 package.json   # Metadados e configuração de inicialização do Node.js
 ┗ 📜 README.md      # Documentação técnica e tutorial How-To de implantação