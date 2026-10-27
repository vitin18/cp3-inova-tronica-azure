const http = require('http');
const https = require('https');
const fs = require('fs');
const PORT = process.env.PORT || 3000;
const USERS_FILE = '/tmp/users.json';

let usuariosMemoria = [
  { user: 'RM95860@fiap.com.br', pass: 'inova2026', nome: 'Vitor (RM95860)', cargo: 'Engenheiro Cloud Lead' }
];

function carregarUsuarios() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      usuariosMemoria = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } else {
      fs.writeFileSync(USERS_FILE, JSON.stringify(usuariosMemoria, null, 2));
    }
  } catch (e) {}
  return usuariosMemoria;
}

function salvarUsuarios(lista) {
  usuariosMemoria = lista;
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(lista, null, 2)); } catch (e) {}
}

function chamarAzureOpenAI(mensagemUsuario, sensores, sensorFocado, usuario) {
  return new Promise((resolve) => {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'chat-ia';

    if (!endpoint || !apiKey) {
      return resolve({ erro: 'Chaves do Azure OpenAI não configuradas no App Service.' });
    }

    const systemPrompt = `Você é o Inova Copilot, engenheiro de IA industrial da fábrica Inova Trônica, rodando no Azure App Service (Linux F1, grupo rg-web-app, web-app-rm95860).
O usuário logado é: ${usuario}.
O sensor atualmente aberto no gráfico da tela é: ${sensorFocado.nome} (${sensorFocado.loc}).

Aqui está a telemetria EM TEMPO REAL de TODOS os 6 equipamentos da fábrica agora:
${JSON.stringify(sensores)}

REGRAS OBRIGATÓRIAS:
1. Responda em Português de forma natural, inteligente, técnica e direta. Use apenas tags HTML simples como <b>, <br> e <code>.
2. Mesmo que o usuário escreva com erros de digitação, entenda perfeitamente e responda sobre o equipamento perguntado.
3. Se o usuário perguntar sobre um equipamento específico, adicione no final da resposta a tag [FOCUS:numero] de 0 a 5 para trocar o gráfico na tela automaticamente:
   - Sensor Nível Radar 80GHz = [FOCUS:0]
   - Sensor Fotoelétrico Laser = [FOCUS:1]
   - Sensor Indutivo M18 = [FOCUS:2]
   - Sensor VisionAI X1 = [FOCUS:3]
   - CLP SmartRelay 4.0 = [FOCUS:4]
   - Gateway ESP32-S3 Cloud = [FOCUS:5]
4. Se o usuário pedir para calibrar, esfriar, corrigir ou resolver a temperatura do CLP, confirme que executou o balanceamento remoto do relé K3 reduzindo a temperatura de 68°C para 46°C e inclua no final a tag [CALIBRAR_CLP].`;

    const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    const url = new URL(`${baseUrl}/openai/deployments/${deployment}/chat/completions?api-version=2024-10-21`);

    const payload = JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: mensagemUsuario }
      ],
      temperature: 0.4,
      max_tokens: 450
    });

    const req = https.request(url, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            resolve({ texto: json.choices[0].message.content, modelo: json.model || 'gpt-4o' });
          } else {
            resolve({ erro: json.error ? json.error.message : 'Resposta inesperada da API' });
          }
        } catch (e) { resolve({ erro: 'Erro ao ler resposta do Azure OpenAI' }); }
      });
    });

    req.on('error', (e) => resolve({ erro: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ erro: 'Tempo limite excedido' }); });
    req.write(payload);
    req.end();
  });
}

const htmlPage = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inova Trônica — Azure OpenAI GPT-4o</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', system-ui, sans-serif; }
    body { margin: 0; background: #0b0f19; color: #f8fafc; min-height: 100vh; }
    #login-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: radial-gradient(circle at top right, #1e3a8a, #0b0f19 60%); padding: 20px; }
    .login-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 30px; width: 100%; max-width: 450px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
    .login-logo { font-size: 24px; font-weight: 800; color: #60a5fa; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
    .copilot-tag { background: linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6); padding: 3px 10px; border-radius: 12px; font-size: 11px; color: #fff; font-weight: bold; }
    .tabs { display: flex; gap: 8px; margin: 16px 0; background: #0f172a; padding: 5px; border-radius: 10px; border: 1px solid #334155; }
    .tab-btn { flex: 1; padding: 9px; border: none; border-radius: 7px; background: transparent; color: #94a3b8; font-weight: 600; font-size: 13px; cursor: pointer; }
    .tab-btn.active { background: #2563eb; color: #fff; }
    .form-group { margin-bottom: 13px; }
    .form-group label { display: block; font-size: 12.5px; color: #94a3b8; margin-bottom: 5px; }
    .form-group input, .form-group select { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 13.5px; }
    .btn-login { width: 100%; padding: 12px; border: none; border-radius: 8px; background: linear-gradient(90deg, #2563eb, #7c3aed); color: #fff; font-weight: bold; font-size: 14.5px; cursor: pointer; margin-top: 4px; }
    .btn-guest { width: 100%; padding: 10px; border: 1px solid #475569; border-radius: 8px; background: #0f172a; color: #38bdf8; font-weight: 600; font-size: 13.5px; cursor: pointer; margin-top: 10px; transition: 0.2s; }
    .btn-guest:hover { background: #1e293b; border-color: #38bdf8; }
    .msg-feedback { font-size: 12.5px; padding: 8px 10px; border-radius: 6px; margin-bottom: 12px; display: none; }
    .users-box { margin-top: 16px; padding-top: 12px; border-top: 1px solid #334155; font-size: 11.5px; color: #94a3b8; }
    .user-chip { display: inline-block; background: #0f172a; border: 1px solid #334155; color: #cbd5e1; padding: 4px 9px; border-radius: 12px; margin: 4px 4px 0 0; cursor: pointer; }
    .user-chip:hover { border-color: #60a5fa; color: #fff; }

    #app-screen { display: none; }
    header { background: #111827; border-bottom: 1px solid #1f2937; padding: 14px 28px; display: flex; justify-content: space-between; align-items: center; }
    .header-left h1 { margin: 0; font-size: 19px; display: flex; align-items: center; gap: 10px; }
    .header-right { display: flex; align-items: center; gap: 12px; font-size: 12.5px; }
    .status-pill { background: #064e3b; color: #34d399; border: 1px solid #059669; padding: 5px 12px; border-radius: 20px; font-weight: 600; }
    .ai-pill { background: #311042; color: #f472b6; border: 1px solid #db2777; padding: 5px 12px; border-radius: 20px; font-weight: 600; }
    .btn-logout { background: #334155; color: #e2e8f0; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
    .main-grid { max-width: 1340px; margin: 20px auto; padding: 0 20px; display: grid; grid-template-columns: 1.15fr 1fr; gap: 22px; }
    .panel { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 18px; }
    .panel h2 { margin-top: 0; font-size: 16px; color: #93c5fd; border-bottom: 1px solid #334155; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .sensor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .product-card { background: #0f172a; border: 2px solid #334155; border-radius: 10px; padding: 11px; cursor: pointer; transition: 0.2s; }
    .product-card:hover { border-color: #60a5fa; }
    .product-card.active { border-color: #a855f7; background: #17153b; }
    .prod-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 13.5px; margin-bottom: 4px; }
    .prod-loc { font-size: 11.5px; color: #38bdf8; margin-bottom: 4px; font-weight: 600; }
    .prod-meta { font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    .tag-ok { color: #4ade80; font-size: 12px; }
    .tag-warn { color: #facc15; font-size: 12px; }
    .chart-box { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; }
    .chart-val { font-size: 18px; font-weight: 800; color: #38bdf8; }
    svg.mini-chart { width: 100%; height: 95px; background: #090d16; border-radius: 8px; border: 1px solid #1e293b; overflow: visible; }
    .telemetry-box { background: #0f172a; border-radius: 10px; padding: 12px; border: 1px solid #334155; font-size: 12.5px; }
    .telemetry-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #1e293b; }
    .copilot-header { background: linear-gradient(90deg, rgba(236,72,153,0.15), rgba(139,92,246,0.15), rgba(59,130,246,0.15)); border: 1px solid #6366f1; padding: 10px 14px; border-radius: 10px; margin-bottom: 10px; font-size: 12.5px; display: flex; justify-content: space-between; align-items: center; }
    #chat-box { height: 320px; overflow-y: auto; background: #0f172a; padding: 14px; border-radius: 10px; border: 1px solid #334155; margin-bottom: 10px; display: flex; flex-direction: column; gap: 10px; }
    .msg { padding: 10px 14px; border-radius: 10px; max-width: 92%; font-size: 13px; line-height: 1.5; }
    .bot { background: #1e1b4b; border: 1px solid #4338ca; color: #e0e7ff; align-self: flex-start; }
    .user { background: #2563eb; color: #fff; align-self: flex-end; }
    .ai-badge { display: inline-block; margin-top: 8px; padding: 3px 8px; border-radius: 6px; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #6ee7b7; font-size: 11px; }
    .script-title { font-size: 11.5px; color: #94a3b8; margin-bottom: 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip { background: #0f172a; border: 1px solid #4f46e5; color: #c7d2fe; padding: 5px 10px; border-radius: 14px; font-size: 11.5px; cursor: pointer; }
    .chip:hover { background: #4f46e5; color: #fff; }
    .input-area { display: flex; gap: 8px; }
    .input-area input { flex: 1; padding: 11px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; }
    .input-area button { background: linear-gradient(90deg, #ec4899, #8b5cf6); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: bold; }
  </style>
</head>
<body>
  <div id="login-screen">
    <div class="login-card">
      <div class="login-logo">⚡ Inova Trônica <span class="copilot-tag">✨ Azure OpenAI GPT-4o</span></div>
      <p style="color:#94a3b8; font-size:12.5px; margin-top:0; margin-bottom:12px;">Portal Cloud de Controle Industrial & Assistente Cognitivo</p>

      <div class="tabs">
        <button type="button" class="tab-btn active" id="tab-login-btn" onclick="mostrarAba('login')">🔑 Entrar</button>
        <button type="button" class="tab-btn" id="tab-reg-btn" onclick="mostrarAba('reg')">➕ Criar Conta</button>
      </div>

      <div id="feedback-box" class="msg-feedback"></div>

      <div id="form-login">
        <div class="form-group"><label>Usuário / E-mail / RM</label><input type="text" id="loginUser" value="RM95860@fiap.com.br" /></div>
        <div class="form-group"><label>Senha de Acesso</label><input type="password" id="loginPass" value="inova2026" /></div>
        <button type="button" class="btn-login" onclick="fazerLogin()">Acessar Planta Industrial</button>
      </div>

      <div id="form-reg" style="display:none;">
        <div class="form-group"><label>Nome Completo / RM</label><input type="text" id="regNome" placeholder="Ex: João Silva (RM99999)" /></div>
        <div class="form-group"><label>E-mail ou Usuário de Login</label><input type="text" id="regUser" placeholder="Ex: joao@inovatronica.com" /></div>
        <div class="form-group">
          <label>Cargo / Setor na Fábrica</label>
          <select id="regCargo">
            <option value="Engenheiro de Automação">Engenheiro de Automação</option>
            <option value="Supervisor de Planta SMT">Supervisor de Planta SMT</option>
            <option value="Analista Cloud & IA">Analista Cloud & IA</option>
            <option value="Técnico de Manutenção">Técnico de Manutenção</option>
          </select>
        </div>
        <div class="form-group"><label>Criar Senha</label><input type="password" id="regPass" placeholder="Digite uma senha..." /></div>
        <button type="button" class="btn-login" onclick="cadastrarUsuario()">💾 Cadastrar e Armazenar Usuário</button>
      </div>

      <button type="button" class="btn-guest" onclick="entrarVisitante()">👀 Entrar como Visitante (Acesso Rápido)</button>

      <div class="users-box">
        <div>👥 <b>Usuários armazenados (clique para preencher):</b></div>
        <div id="lista-usuarios-chips" style="margin-top:4px;"></div>
      </div>
    </div>
  </div>

  <div id="app-screen">
    <header>
      <div class="header-left"><h1>⚡ Inova Trônica — Monitoramento Industrial <span class="copilot-tag">Azure OpenAI GPT-4o Live</span></h1></div>
      <div class="header-right">
        <span class="ai-pill">🧠 IA: openai-inova-rm95860 (GPT-4o)</span>
        <span class="status-pill">● App Service Linux (F1)</span>
        <span id="userDisplay" style="color:#cbd5e1; font-weight:600;">👤 RM95860</span>
        <button type="button" class="btn-logout" onclick="logout()">Trocar Usuário / Sair</button>
      </div>
    </header>

    <div class="main-grid">
      <div class="panel">
        <h2><span>📡 Sensores na Fábrica (Clique ou pergunte no chat)</span><small style="color:#38bdf8; font-size:12px;">6 Dispositivos Ativos</small></h2>
        <div class="sensor-grid">
          <div class="product-card active" id="card-0" onclick="selecionarProduto(0)">
            <div class="prod-header"><span>1. Sensor Nível Radar 80GHz</span><span class="tag-ok">● 78.4%</span></div>
            <div class="prod-loc">📍 Setor A1: Silo Químico de Resina</div>
            <div class="prod-meta"><span>Série: RAD-80G-01</span><span>Sem Contato</span></div>
          </div>
          <div class="product-card" id="card-1" onclick="selecionarProduto(1)">
            <div class="prod-header"><span>2. Sensor Fotoelétrico Laser</span><span class="tag-ok">● 1.240 pç/h</span></div>
            <div class="prod-loc">📍 Setor B2: Esteira de Embalagem</div>
            <div class="prod-meta"><span>Série: FOT-LSR-02</span><span>Feixe Óptico</span></div>
          </div>
          <div class="product-card" id="card-2" onclick="selecionarProduto(2)">
            <div class="prod-header"><span>3. Sensor Indutivo M18</span><span class="tag-ok">● 4.2 mm</span></div>
            <div class="prod-loc">📍 Setor C1: Braço Robótico Solda</div>
            <div class="prod-meta"><span>Série: IND-M18-03</span><span>Proximidade Metal</span></div>
          </div>
          <div class="product-card" id="card-3" onclick="selecionarProduto(3)">
            <div class="prod-header"><span>4. Sensor VisionAI X1</span><span class="tag-ok">● 99.4% IA</span></div>
            <div class="prod-loc">📍 Setor D3: Linha Montagem SMT</div>
            <div class="prod-meta"><span>Série: VIS-AI-04</span><span>Inspeção PCB</span></div>
          </div>
          <div class="product-card" id="card-4" onclick="selecionarProduto(4)">
            <div class="prod-header"><span>5. CLP SmartRelay 4.0</span><span class="tag-warn" id="clp-badge">▲ 68°C Alerta</span></div>
            <div class="prod-loc">📍 Setor E1: Subestação Térmica</div>
            <div class="prod-meta"><span>Série: CLP-SR-05</span><span id="clp-sub">Requer Calibração</span></div>
          </div>
          <div class="product-card" id="card-5" onclick="selecionarProduto(5)">
            <div class="prod-header"><span>6. Gateway ESP32-S3 Cloud</span><span class="tag-ok">● 12 ms</span></div>
            <div class="prod-loc">📍 Setor TI: Rack Central IoT</div>
            <div class="prod-meta"><span>Série: ESP-GW-06</span><span>MQTT Azure</span></div>
          </div>
        </div>

        <div class="chart-box">
          <div class="chart-header">
            <div>
              <strong style="color:#f8fafc;" id="chart-title">📈 Curva em Tempo Real: Sensor Nível Radar 80GHz</strong>
              <div style="font-size:11.5px; color:#94a3b8;" id="chart-sub">📍 Setor A1 — Silo Químico de Resina Epóxi</div>
            </div>
            <div class="chart-val" id="chart-current">78.4 %</div>
          </div>
          <svg class="mini-chart" id="telemetry-svg" viewBox="0 0 500 95"></svg>
        </div>

        <div class="telemetry-box">
          <div class="telemetry-row"><span>📍 Localização na Fábrica:</span> <strong id="t-loc" style="color:#38bdf8;">Setor A1 — Silo Químico de Resina Epóxi</strong></div>
          <div class="telemetry-row"><span>⚙️ Função Industrial:</span> <span id="t-func">Medição contínua de nível líquido sem contato por ondas de radar 80GHz</span></div>
          <div class="telemetry-row"><span>☁️ Recursos Azure CLI:</span> <span>rg-web-app | plan-web-app | web-app-rm95860 | openai-inova-rm95860</span></div>
          <div class="telemetry-row"><span>🩺 Diagnóstico Cognitivo:</span> <span id="t-diag" style="color:#4ade80;">Nível estável em 78.4% — Sem risco de transbordo</span></div>
        </div>
      </div>

      <div class="panel">
        <h2><span>🤖 Inova Copilot — IA Generativa Real (Azure OpenAI)</span><span class="copilot-tag">GPT-4o Live</span></h2>
        <div class="copilot-header">
          <span>🎯 <b>Sensor em foco:</b> <span id="copilot-focus">Sensor Nível Radar 80GHz</span> (<span id="copilot-sector" style="color:#38bdf8;">Setor A1</span>)</span>
        </div>
        <div id="chat-box"></div>
        <div class="script-title">📋 Sugestões de Perguntas para o GPT-4o:</div>
        <div class="chips">
          <span class="chip" onclick="perguntar('Olá! Como está a operação do meu CLP? Ele parece operando a uma temperatura diferente')">🔥 1. Por que meu CLP está quente?</span>
          <span class="chip" onclick="perguntar('Por favor, calibre o CLP remotamente agora para baixar a temperatura')">🛠️ 2. Calibrar CLP com IA</span>
          <span class="chip" onclick="perguntar('Compare os sensores Radar, Fotoelétrico e Indutivo da nossa fábrica e diga onde ficam')">📡 3. Comparar Radar, Foto e Indutivo</span>
          <span class="chip" onclick="perguntar('Faça um resumo geral da saúde de todos os 6 equipamentos da planta')">📊 4. Resumo Geral da Planta</span>
        </div>
        <div class="input-area">
          <input type="text" id="msgInput" placeholder="Converse livremente com o GPT-4o da Azure sobre a fábrica..." onkeypress="if(event.key==='Enter') enviar()" />
          <button type="button" onclick="enviar()">Perguntar ✨</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const produtos = [
      { idx: 0, nome: 'Sensor Nível Radar 80GHz', tipo: 'radar', loc: 'Setor A1 — Silo Químico de Resina Epóxi', func: 'Medição contínua de nível sem contato via micro-ondas de 80GHz.', diag: 'Nível estável em 78.4% (11.760L no Silo) — Operação nominal.', faixa: '10% a 90%', unidade: '%', alerta: false, dados: [71.2, 73.0, 74.5, 75.8, 76.4, 77.1, 78.0, 78.4] },
      { idx: 1, nome: 'Sensor Fotoelétrico Laser', tipo: 'fotoeletrico', loc: 'Setor B2 — Esteira de Alta Velocidade (Embalagem)', func: 'Detecção óptica por feixe laser para contagem de caixas e presença de kits.', diag: 'Operação nominal — Contagem atual: 1.240 unidades/hora.', faixa: '800 a 1.500 pç/h', unidade: ' pç/h', alerta: false, dados: [1180, 1205, 1190, 1220, 1235, 1228, 1242, 1240] },
      { idx: 2, nome: 'Sensor Indutivo M18', tipo: 'indutivo', loc: 'Setor C1 — Célula Robótica de Solda e Estampagem', func: 'Detecção magnética sem contato de peças metálicas no braço robótico.', diag: 'Distância de comutação em 4.2mm — Precisão magnética 100%.', faixa: '0.5mm a 8.0mm', unidade: ' mm', alerta: false, dados: [4.1, 4.2, 4.2, 4.3, 4.1, 4.2, 4.2, 4.2] },
      { idx: 3, nome: 'Sensor VisionAI X1', tipo: 'visao', loc: 'Setor D3 — Linha de Montagem Superficial (SMT)', func: 'Inspeção visual automatizada por câmera + IA para placas PCB.', diag: 'IA operando com 99.4% de acurácia — 0 defeitos críticos.', faixa: '> 98% IA', unidade: '% IA', alerta: false, dados: [99.1, 99.2, 99.3, 99.2, 99.4, 99.5, 99.3, 99.4] },
      { idx: 4, nome: 'CLP SmartRelay 4.0', tipo: 'clp', loc: 'Setor E1 — Painel Central da Subestação Térmica', func: 'Controle lógico dos atuadores, válvulas e intertravamento térmico da planta.', diag: 'ANOMALIA TÉRMICA: Operando a 68°C (Faixa normal: 40°C a 55°C) — Sobrecarga no relé K3.', faixa: '40°C a 55°C', unidade: ' °C', alerta: true, dados: [51, 54, 57, 60, 62, 65, 67, 68] },
      { idx: 5, nome: 'Gateway ESP32-S3 Cloud', tipo: 'gateway', loc: 'Setor TI Industrial — Rack Central de Telemetria IoT', func: 'Concentrador de dados dos sensores industriais conectado ao Azure.', diag: 'Conectado ao Azure Brazil South — Latência média de 12ms.', faixa: '< 50 ms', unidade: ' ms', alerta: false, dados: [15, 14, 13, 14, 12, 11, 13, 12] }
    ];
    let produtoAtual = produtos[0];
    let usuarioLogado = 'Vitor (RM95860)';

    function mostrarFeedback(msg, erro) {
      const box = document.getElementById('feedback-box');
      box.style.display = 'block';
      box.style.background = erro ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)';
      box.style.border = erro ? '1px solid #ef4444' : '1px solid #22c55e';
      box.style.color = erro ? '#fca5a5' : '#86efac';
      box.innerText = msg;
    }

    function mostrarAba(aba) {
      document.getElementById('feedback-box').style.display = 'none';
      if (aba === 'login') {
        document.getElementById('form-login').style.display = 'block';
        document.getElementById('form-reg').style.display = 'none';
        document.getElementById('tab-login-btn').classList.add('active');
        document.getElementById('tab-reg-btn').classList.remove('active');
      } else {
        document.getElementById('form-login').style.display = 'none';
        document.getElementById('form-reg').style.display = 'block';
        document.getElementById('tab-login-btn').classList.remove('active');
        document.getElementById('tab-reg-btn').classList.add('active');
      }
    }

    async function atualizarListaUsuarios() {
      const container = document.getElementById('lista-usuarios-chips');
      container.innerHTML = '';
      try {
        const res = await fetch('/api/users');
        const lista = await res.json();
        lista.forEach(u => {
          const span = document.createElement('span');
          span.className = 'user-chip';
          span.innerText = '👤 ' + u.nome + ' (' + u.cargo + ')';
          span.onclick = function() {
            mostrarAba('login');
            document.getElementById('loginUser').value = u.user;
            document.getElementById('loginPass').value = u.user === 'RM95860@fiap.com.br' ? 'inova2026' : '';
            document.getElementById('loginPass').focus();
          };
          container.appendChild(span);
        });
      } catch (e) {
        container.innerText = '👤 Vitor (RM95860)';
      }
    }

    async function cadastrarUsuario() {
      const nome = document.getElementById('regNome').value.trim();
      const user = document.getElementById('regUser').value.trim();
      const cargo = document.getElementById('regCargo').value;
      const pass = document.getElementById('regPass').value.trim();
      if (!nome || !user || !pass) return mostrarFeedback('Preencha nome, usuário e senha!', true);

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, user, cargo, pass })
      });
      const data = await res.json();
      if (!data.ok) return mostrarFeedback(data.msg, true);

      await atualizarListaUsuarios();
      mostrarFeedback('✅ Conta criada e armazenada com sucesso! Entrando...', false);
      setTimeout(() => iniciarSessao(nome + ' — ' + cargo), 600);
    }

    async function fazerLogin() {
      const user = document.getElementById('loginUser').value.trim();
      const pass = document.getElementById('loginPass').value.trim();
      if (!user || !pass) return mostrarFeedback('Informe usuário e senha!', true);

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass })
      });
      const data = await res.json();
      if (!data.ok) return mostrarFeedback(data.msg, true);

      iniciarSessao(data.usuario.nome + ' (' + data.usuario.cargo + ')');
    }

    function entrarVisitante() {
      iniciarSessao('Visitante Externo (Modo Demonstração)');
    }

    function iniciarSessao(rotuloUsuario) {
      usuarioLogado = rotuloUsuario;
      document.getElementById('userDisplay').innerText = '👤 ' + rotuloUsuario;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-screen').style.display = 'block';
      document.getElementById('chat-box').innerHTML =
        '<div class="msg bot">Olá, <b>' + rotuloUsuario + '</b>! Bem-vindo ao Portal Cloud da <b>Inova Trônica</b>.<br><br>' +
        'Estou conectado ao modelo <b>GPT-4o real do Azure OpenAI (openai-inova-rm95860)</b> e monitorando os 6 sensores da fábrica. O que deseja analisar?' +
        '<div><span class="ai-badge">🧠 Sessão Autenticada • Azure OpenAI GPT-4o Live</span></div></div>';
      desenharGrafico();
    }

    function logout() {
      document.getElementById('app-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('feedback-box').style.display = 'none';
      atualizarListaUsuarios();
    }

    function desenharGrafico() {
      const svg = document.getElementById('telemetry-svg');
      const dados = produtoAtual.dados;
      const min = Math.min(...dados) * 0.92;
      const max = Math.max(...dados) * 1.05 || 1;
      const w = 500, h = 95, pad = 18;
      const pts = dados.map((v, i) => ({ x: pad + (i * (w - pad * 2) / (dados.length - 1)), y: h - pad - ((v - min) / (max - min)) * (h - pad * 2), v }));
      const pathLine = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
      const pathArea = pathLine + ' L' + pts[pts.length - 1].x + ',' + (h - 5) + ' L' + pts[0].x + ',' + (h - 5) + ' Z';
      const cor = produtoAtual.alerta ? '#facc15' : '#38bdf8';
      let circles = '';
      pts.forEach(p => { circles += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="' + cor + '" /><text x="' + p.x + '" y="' + (p.y - 7) + '" fill="#cbd5e1" font-size="10" text-anchor="middle">' + p.v + '</text>'; });
      svg.innerHTML = '<defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + cor + '" stop-opacity="0.4"/><stop offset="100%" stop-color="' + cor + '" stop-opacity="0.0"/></linearGradient></defs><path d="' + pathArea + '" fill="url(#grad)" /><path d="' + pathLine + '" fill="none" stroke="' + cor + '" stroke-width="2.5" />' + circles;
      document.getElementById('chart-title').innerText = '📈 Curva em Tempo Real: ' + produtoAtual.nome;
      document.getElementById('chart-sub').innerText = '📍 ' + produtoAtual.loc;
      document.getElementById('chart-current').innerText = dados[dados.length - 1] + produtoAtual.unidade;
      document.getElementById('chart-current').style.color = cor;
    }

    function selecionarProduto(index, silencioso) {
      document.querySelectorAll('.product-card').forEach(c => c.classList.remove('active'));
      const card = document.getElementById('card-' + index);
      if (card) card.classList.add('active');
      produtoAtual = produtos[index];
      document.getElementById('t-loc').innerText = produtoAtual.loc;
      document.getElementById('t-func').innerText = produtoAtual.func;
      document.getElementById('t-diag').innerText = produtoAtual.diag;
      document.getElementById('t-diag').style.color = produtoAtual.alerta ? '#facc15' : '#4ade80';
      document.getElementById('copilot-focus').innerText = produtoAtual.nome;
      document.getElementById('copilot-sector').innerText = produtoAtual.loc.split('—')[0].trim();
      desenharGrafico();
      if (!silencioso) {
        const chat = document.getElementById('chat-box');
        chat.innerHTML += '<div class="msg bot">🔄 <b>Painel focado em:</b> ' + produtoAtual.nome + ' (' + produtoAtual.loc + ').</div>';
        chat.scrollTop = chat.scrollHeight;
      }
    }

    function perguntar(texto) { document.getElementById('msgInput').value = texto; enviar(); }

    async function enviar() {
      const input = document.getElementById('msgInput');
      const texto = input.value.trim();
      if (!texto) return;
      const chat = document.getElementById('chat-box');
      chat.innerHTML += '<div class="msg user">' + texto + '</div>';
      input.value = '';
      const loadingId = 'load-' + Date.now();
      chat.innerHTML += '<div class="msg bot" id="' + loadingId + '">⏳ <i>GPT-4o (Azure OpenAI) analisando telemetria...</i></div>';
      chat.scrollTop = chat.scrollHeight;

      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: texto, sensorFocado: produtoAtual, sensores: produtos, user: usuarioLogado })
      });
      const data = await res.json();

      if (typeof data.switchIdx === 'number') selecionarProduto(data.switchIdx, true);
      if (data.calibrarCLP) {
        produtos[4].dados = [68, 63, 58, 53, 50, 48, 47, 46];
        produtos[4].alerta = false;
        produtos[4].diag = 'CALIBRADO VIA AZURE OPENAI GPT-4o: Temperatura estabilizada em 46°C (Relé K3 normalizado).';
        document.getElementById('clp-badge').className = 'tag-ok';
        document.getElementById('clp-badge').innerText = '● 46°C Normal';
        document.getElementById('clp-sub').innerText = 'Calibrado via IA';
        selecionarProduto(4, true);
      }

      const loadEl = document.getElementById(loadingId);
      if (loadEl) loadEl.innerHTML = data.reply;
      chat.scrollTop = chat.scrollHeight;
    }

    atualizarListaUsuarios();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlPage);
  } else if (req.method === 'GET' && req.url === '/api/users') {
    const lista = carregarUsuarios().map(u => ({ user: u.user, nome: u.nome, cargo: u.cargo }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(lista));
  } else if (req.method === 'POST' && req.url === '/api/register') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let d = {};
      try { d = JSON.parse(body); } catch (e) {}
      const usuarios = carregarUsuarios();
      if (usuarios.find(u => u.user.toLowerCase() === (d.user || '').toLowerCase())) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, msg: 'Este usuário/e-mail já está cadastrado!' }));
      }
      usuarios.push({ user: d.user, pass: d.pass, nome: d.nome, cargo: d.cargo || 'Engenheiro' });
      salvarUsuarios(usuarios);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  } else if (req.method === 'POST' && req.url === '/api/login') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let d = {};
      try { d = JSON.parse(body); } catch (e) {}
      const usuarios = carregarUsuarios();
      const encontrado = usuarios.find(u => u.user.toLowerCase() === (d.user || '').toLowerCase() && u.pass === d.pass);
      if (!encontrado) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, msg: 'Usuário ou senha inválidos! Crie uma conta ou entre como Visitante.' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, usuario: encontrado }));
    });
  } else if (req.method === 'POST' && req.url === '/api/copilot') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let data = {};
      try { data = JSON.parse(body); } catch (e) {}
      const resultado = await chamarAzureOpenAI(data.message || '', data.sensores || [], data.sensorFocado || {}, data.user || 'RM95860');
      let switchIdx = null, calibrarCLP = false, replyText = '';
      if (resultado.texto) {
        replyText = resultado.texto;
        const matchFocus = replyText.match(/\[FOCUS:(\d)\]/);
        if (matchFocus) { switchIdx = parseInt(matchFocus[1], 10); replyText = replyText.replace(/\[FOCUS:\d\]/g, ''); }
        if (replyText.includes('[CALIBRAR_CLP]')) { calibrarCLP = true; switchIdx = 4; replyText = replyText.replace(/\[CALIBRAR_CLP\]/g, ''); }
        replyText = replyText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
        replyText += `<div><span class="ai-badge">🧠 Gerado ao vivo por Azure OpenAI (${resultado.modelo}) • openai-inova-rm95860</span></div>`;
      } else {
        replyText = `⚠️ <b>Aviso Azure OpenAI:</b> ${resultado.erro}`;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ reply: replyText, switchIdx, calibrarCLP }));
    });
  } else { res.writeHead(404); res.end('Not Found'); }
});
server.listen(PORT, () => console.log('Inova Trônica Azure OpenAI GPT-4o rodando na porta ' + PORT));
