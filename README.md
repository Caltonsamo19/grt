# 🤖 Bot Detector de Concorrentes - WhatsApp

Bot automatizado para detectar e remover vendedores concorrentes de grupos do WhatsApp.

## 🚀 Funcionalidades

### ✅ Detecção e Remoção Automática
- Monitora quando concorrentes entram nos grupos
- Remove automaticamente quando detecta entrada (se `removerAutomatico: true`)
- **🔥 NOVO**: Ao adicionar número com `.add`, busca e remove de TODOS os grupos instantaneamente
- Notifica administradores por DM e no grupo
- **Proteção especial**: Administradores dos grupos NUNCA são removidos

### 🕐 Verificação Diária Automática
- **Executa todos os dias às 00:00** (horário de Brasília)
- Verifica TODOS os grupos em busca de concorrentes
- Remove automaticamente membros que estão na lista (exceto admins)
- **🔥 NOVO**: Envia notificação em cada grupo após a verificação
- Gera relatório completo no console
- Registra todas as ações no histórico

### 📋 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `.status` | Ver status do detector |
| `.scan` | Escanear membros do grupo atual |
| `.verificar` | Executar verificação completa em todos os grupos manualmente |
| `.ban` | **🔥 Banir membro (responda à mensagem dele)** |
| `.ban add` | **🔥 Banir membro + adicionar à lista de concorrentes** |
| `.a` | **🔥 Abrir grupo (todos podem enviar mensagens)** |
| `.f [motivo]` | **🔥 Fechar grupo com motivo opcional** |
| `.todos [mensagem]` | **🔥 Mencionar todos os membros** |
| `.addgrupo` | Adicionar TODOS os membros do grupo à lista |
| `.concorrentes` | Listar concorrentes cadastrados |
| `.add <número>` | Adicionar concorrente + buscar e remover de TODOS os grupos |
| `.remove <número>` | Remover concorrente da lista |
| `.deteccoes` | Ver histórico de detecções |
| `.config` | Ver/alterar configurações |
| `.ajuda` | Ajuda completa |

### ⚙️ Configurações

Altere as configurações com `.config`:

```
.config remover on        # Ativa remoção automática
.config remover off       # Desativa remoção automática
.config admins on         # Notificar admins por DM
.config grupo on          # Notificar no grupo
.config verificacao on    # 🔥 Notificar grupos após verificação diária
.config verificacao off   # Desativar notificação de verificação diária
```

## 📦 Instalação

```bash
npm install
```

## 🚀 Executar

```bash
npm start
```

## 📁 Arquivos

- `bot-detector.js` - Código principal do bot
- `competitors.json` - Lista de números concorrentes
- `bot-config.json` - Configurações do bot
- `grupos-coleta.json` - Grupos para coleta automática
- `detections-log.json` - Histórico de detecções

## 🔧 Configuração Recomendada

1. **Ative a remoção automática**:
   ```
   .config remover on
   ```

2. **Configure notificações**:
   ```
   .config admins on
   .config grupo on
   .config verificacao on
   ```

3. **Adicione grupos para coleta automática**:
   Edite `grupos-coleta.json` e adicione os nomes dos grupos

## 📢 Comando de Menção em Massa

### `.todos` - Mencionar Todos
Menciona **todos os membros do grupo** enviando uma notificação para cada um.

**Uso simples (sem mensagem):**
```
.todos
```

**Resposta:**
```
📢 ATENÇÃO GERAL 📢

Todos foram mencionados!
```
✅ Todos os membros recebem notificação

**Uso com mensagem personalizada:**
```
.todos Reunião importante às 15h!
```

**Resposta:**
```
📢 ATENÇÃO GERAL 📢

Reunião importante às 15h!
```
✅ Todos os membros recebem notificação com a mensagem

**Outros exemplos:**
```
.todos Atenção! Promoção relâmpago por 2 horas
.todos Grupo será fechado para manutenção em 10min
.todos Parabéns ao vendedor do mês!
.todos Comunicado importante - Leiam todos
.todos Novos produtos chegaram! Confiram o catálogo
```

**Comandos alternativos:**
```
.todos [mensagem]
.everyone [mensagem]
.all [mensagem]
```
(Todos funcionam da mesma forma)

### 🛡️ Segurança:
- ✅ **Apenas administradores** podem usar este comando
- ✅ **Só funciona em grupos** (não funciona em DM)
- 📝 **Registro no console** - Todas as menções são logadas
- 👥 **Conta participantes** - Mostra quantas pessoas foram mencionadas

### 💡 Casos de Uso:
- 📢 **Comunicados urgentes** - Garante que todos vejam
- 🎉 **Eventos e promoções** - Avisar sobre novidades
- ⚠️ **Alertas importantes** - Chamar atenção geral
- 📊 **Reuniões** - Convocar todos os membros
- 🎯 **Engajamento** - Aumentar participação no grupo

## 🔓🔒 Comandos de Controle do Grupo

### `.a` - Abrir Grupo
Permite que **todos os membros** possam enviar mensagens no grupo.

**Uso:**
```
.a
```

**Resposta:**
```
✅ GRUPO ABERTO

🔓 Todos os membros podem enviar mensagens agora
```

### `.f` - Fechar Grupo
Restringe o grupo para que **apenas administradores** possam enviar mensagens.

**Uso simples:**
```
.f
```

**Resposta:**
```
🔒 GRUPO FECHADO

⚠️ Apenas administradores podem enviar mensagens agora
```

**Uso com motivo:**
```
.f Voltamos Brevemente
```

**Resposta:**
```
🔒 GRUPO FECHADO

⚠️ Apenas administradores podem enviar mensagens agora

📝 Motivo:
Voltamos Brevemente
```

**Outros exemplos:**
```
.f Reunião de admins em andamento
.f Manutenção do grupo
.f Grupo temporariamente fechado
.f Horário de expediente encerrado
```

### 🛡️ Segurança:
- ✅ **Apenas administradores** podem usar estes comandos
- ✅ **Só funciona em grupos** (não funciona em DM)
- ✅ **Requer permissões** - O bot precisa ser admin do grupo
- 📝 **Registro no console** - Todas as ações são logadas

### 💡 Casos de Uso:
- 🎯 **Controle de spam** - Feche o grupo quando houver spam
- 📢 **Anúncios importantes** - Feche para fazer anúncios sem interrupções
- 🎉 **Discussões abertas** - Abra para permitir participação geral
- 🚨 **Emergências** - Feche rapidamente em situações de conflito

## 🔨 Como usar o comando .ban

O comando `.ban` permite que administradores removam membros instantaneamente respondendo à mensagem deles.

### 📝 Como usar:

1. **Encontre a mensagem** do membro que deseja banir
2. **Responda à mensagem** dele
3. **Digite** `.ban` ou `.ban add`

### 🎯 Variações:

**`.ban`** - Remove apenas do grupo atual
```
Responder mensagem → .ban

✅ MEMBRO BANIDO

👤 Nome: João Silva
📱 Número: 258841234567
📍 Grupo: Vendedores MZ
⚡ Ação: Removido do grupo

💡 Dica: Use .ban add para adicionar à lista de concorrentes
```

**`.ban add`** - Remove do grupo + adiciona à lista de concorrentes
```
Responder mensagem → .ban add

✅ MEMBRO BANIDO

👤 Nome: João Silva
📱 Número: 258841234567
📍 Grupo: Vendedores MZ
⚡ Ação: Removido do grupo

📋 Adicionado à lista de concorrentes
🔴 Este número será bloqueado em TODOS os grupos
```

### 🛡️ Proteções:

- ❌ **Não funciona em administradores** - Admins não podem ser banidos
- ✅ **Apenas admins podem usar** - Membros comuns não têm acesso
- ✅ **Registro completo** - Todas as ações são registradas no histórico

## 🔥 Como usar o comando .add

Quando você adiciona um número com `.add`, o bot:

1. ✅ Adiciona o número à lista de concorrentes
2. 🔍 Verifica TODOS os grupos monitorados
3. 🚨 Se encontrar o número em algum grupo:
   - Se for admin → Apenas notifica (não remove)
   - Se não for admin → **Remove automaticamente**
4. 📊 Envia relatório completo com todas as ações

**Exemplo:**
```
.add 258841234567
```

**Resposta do bot:**
```
✅ Concorrente adicionado!
📱 258841234567

⏳ Verificando grupos e removendo automaticamente...

📊 RELATÓRIO DE VERIFICAÇÃO

📱 Número: 258841234567
👥 Grupos verificados: 15
🚨 Encontrado em: 3 grupo(s)

Detalhes:
1. Grupo Vendedores MZ
   ✅ Removido
2. Grupo Negócios
   ✅ Removido
3. Grupo Admins
   👑 ADMIN (não removido)

📊 Resumo:
   • Removidos: 2
   • Protegidos (admins): 1

💾 Total na lista: 1.234 números
```

## 🛡️ Proteções

- ✅ Administradores dos grupos **NUNCA** são removidos
- ✅ Verificação diária automática às 00:00
- ✅ Histórico completo de todas as ações
- ✅ Delays entre remoções para evitar sobrecarga
- ✅ Logs detalhados de todas as operações

## 📊 Verificação Diária

A verificação diária automática:
- ⏰ Executa às **00:00** todos os dias
- 🔍 Verifica **TODOS** os grupos
- 🚨 Detecta concorrentes que já estão nos grupos
- ✅ Remove automaticamente (se configurado)
- 📋 Gera relatório completo
- 📝 Registra no histórico de detecções

Para executar manualmente, use: `.verificar`

## 🔒 Segurança

- Apenas administradores podem executar comandos sensíveis
- Todos os arquivos são salvos localmente
- Autenticação via WhatsApp Web (qrcode)
- Session persistente (não precisa escanear sempre)

## 📝 Licença

MIT
