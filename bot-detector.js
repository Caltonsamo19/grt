require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const cron = require('node-cron');

// ===================================
// 🔍 BOT DETECTOR DE CONCORRENTES
// ===================================
// Monitora grupos e detecta quando vendedores concorrentes entram
// Notifica admins automaticamente

console.log('🚀 Iniciando Bot Detector de Concorrentes...\n');

// === CONFIGURAÇÕES ===
const ARQUIVO_CONCORRENTES = path.join(__dirname, 'competitors.json');
const ARQUIVO_LOGS = path.join(__dirname, 'detections-log.json');
const ARQUIVO_CONFIG = path.join(__dirname, 'bot-config.json');
const ARQUIVO_GRUPOS_COLETA = path.join(__dirname, 'grupos-coleta.json');

// === DADOS EM MEMÓRIA ===
let concorrentes = new Set(); // Lista de números concorrentes
let deteccoesLog = []; // Histórico de detecções
let gruposColeta = new Set(); // Lista de nomes de grupos para coletar automaticamente
let config = {
    notificarAdmins: true,
    notificarGrupo: true,
    removerAutomatico: false,
    notificarVerificacaoDiaria: true,
    mensagemCustomizada: null
};

// === INICIALIZAÇÃO DO CLIENT ===
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'bot-detector',
        dataPath: './.wwebjs_detector'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// ===================================
// 📂 FUNÇÕES DE ARQUIVO
// ===================================

// Carregar lista de concorrentes
async function carregarConcorrentes() {
    try {
        if (fssync.existsSync(ARQUIVO_CONCORRENTES)) {
            const data = await fs.readFile(ARQUIVO_CONCORRENTES, 'utf-8');
            const lista = JSON.parse(data);
            concorrentes = new Set(lista);
            console.log(`✅ ${concorrentes.size} números de concorrentes carregados`);
        } else {
            console.log('⚠️  Arquivo de concorrentes não encontrado, criando vazio...');
            await salvarConcorrentes();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar concorrentes:', error.message);
    }
}

// Salvar lista de concorrentes
async function salvarConcorrentes() {
    try {
        await fs.writeFile(
            ARQUIVO_CONCORRENTES,
            JSON.stringify([...concorrentes], null, 2),
            'utf-8'
        );
        console.log('💾 Lista de concorrentes salva');
    } catch (error) {
        console.error('❌ Erro ao salvar concorrentes:', error.message);
    }
}

// Carregar logs de detecções
async function carregarLogs() {
    try {
        if (fssync.existsSync(ARQUIVO_LOGS)) {
            const data = await fs.readFile(ARQUIVO_LOGS, 'utf-8');
            deteccoesLog = JSON.parse(data);
            console.log(`📋 ${deteccoesLog.length} detecções anteriores carregadas`);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar logs:', error.message);
    }
}

// Salvar logs de detecções
async function salvarLogs() {
    try {
        await fs.writeFile(
            ARQUIVO_LOGS,
            JSON.stringify(deteccoesLog, null, 2),
            'utf-8'
        );
    } catch (error) {
        console.error('❌ Erro ao salvar logs:', error.message);
    }
}

// Carregar configurações
async function carregarConfig() {
    try {
        if (fssync.existsSync(ARQUIVO_CONFIG)) {
            const data = await fs.readFile(ARQUIVO_CONFIG, 'utf-8');
            config = { ...config, ...JSON.parse(data) };
            console.log('⚙️  Configurações carregadas');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar config:', error.message);
    }
}

// Salvar configurações
async function salvarConfig() {
    try {
        await fs.writeFile(
            ARQUIVO_CONFIG,
            JSON.stringify(config, null, 2),
            'utf-8'
        );
    } catch (error) {
        console.error('❌ Erro ao salvar config:', error.message);
    }
}

// Carregar grupos de coleta
async function carregarGruposColeta() {
    try {
        if (fssync.existsSync(ARQUIVO_GRUPOS_COLETA)) {
            const data = await fs.readFile(ARQUIVO_GRUPOS_COLETA, 'utf-8');
            const lista = JSON.parse(data);
            gruposColeta = new Set(lista);
            console.log(`📋 ${gruposColeta.size} grupos configurados para coleta automática`);
        } else {
            console.log('⚠️  Arquivo grupos-coleta.json não encontrado, criando vazio...');
            await salvarGruposColeta();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar grupos de coleta:', error.message);
    }
}

// Salvar grupos de coleta
async function salvarGruposColeta() {
    try {
        await fs.writeFile(
            ARQUIVO_GRUPOS_COLETA,
            JSON.stringify([...gruposColeta], null, 2),
            'utf-8'
        );
        console.log('💾 Lista de grupos de coleta salva');
    } catch (error) {
        console.error('❌ Erro ao salvar grupos de coleta:', error.message);
    }
}

// ===================================
// 🎯 DETECTOR DE CONCORRENTES
// ===================================

// Verificar se um número é concorrente
function isConcorrente(numero) {
    // Normalizar número (remover @c.us, espaços, etc)
    const numeroLimpo = numero.replace('@c.us', '').replace(/\s/g, '');
    return concorrentes.has(numeroLimpo);
}

// Adicionar concorrente
async function adicionarConcorrente(numero) {
    const numeroLimpo = numero.replace('@c.us', '').replace(/\s/g, '');
    concorrentes.add(numeroLimpo);
    await salvarConcorrentes();
    return numeroLimpo;
}

// Remover concorrente
async function removerConcorrente(numero) {
    const numeroLimpo = numero.replace('@c.us', '').replace(/\s/g, '');
    const removido = concorrentes.delete(numeroLimpo);
    if (removido) {
        await salvarConcorrentes();
    }
    return removido;
}

// Registrar detecção
async function registrarDeteccao(grupoId, grupoNome, numeroDetectado, nomeContato, acaoTomada) {
    const deteccao = {
        timestamp: new Date().toISOString(),
        data: new Date().toLocaleString('pt-BR'),
        grupoId,
        grupoNome,
        numeroDetectado,
        nomeContato,
        acaoTomada
    };

    deteccoesLog.unshift(deteccao); // Adiciona no início

    // Manter apenas últimas 500 detecções
    if (deteccoesLog.length > 500) {
        deteccoesLog = deteccoesLog.slice(0, 500);
    }

    await salvarLogs();

    console.log(`\n🚨 CONCORRENTE DETECTADO!`);
    console.log(`📍 Grupo: ${grupoNome}`);
    console.log(`📱 Número: ${numeroDetectado}`);
    console.log(`👤 Nome: ${nomeContato}`);
    console.log(`⚡ Ação: ${acaoTomada}\n`);

    return deteccao;
}

// Obter admins do grupo
async function obterAdminsGrupo(grupoId) {
    try {
        const chat = await client.getChatById(grupoId);
        if (!chat.isGroup) return [];

        const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
        return admins.map(a => a.id._serialized);
    } catch (error) {
        console.error('❌ Erro ao obter admins:', error.message);
        return [];
    }
}

// Notificar admins sobre concorrente detectado
async function notificarAdmins(grupoId, grupoNome, numeroDetectado, nomeContato, isAdmin = false) {
    try {
        const chat = await client.getChatById(grupoId);

        let mensagem = config.mensagemCustomizada ||
            `🚨 *ALERTA DE CONCORRENTE DETECTADO!*\n\n` +
            `📍 *Grupo:* ${grupoNome}\n` +
            `👤 *Nome:* ${nomeContato}\n` +
            `📱 *Número:* ${numeroDetectado.replace('@c.us', '')}\n` +
            `⚠️ *Status:* Este número está na lista de vendedores concorrentes\n`;

        // Adicionar aviso especial se for admin
        if (isAdmin) {
            mensagem += `\n👑 *ATENÇÃO:* Esta pessoa é ADMINISTRADOR do grupo!\n`;
            mensagem += `🛡️ *Proteção ativa:* Admins NÃO serão removidos automaticamente\n\n`;
            mensagem += `🔧 *Ação recomendada:* Avaliar manualmente se deve permanecer como admin\n`;
        } else {
            mensagem += `\n🔧 *Ação recomendada:* Verificar e remover se necessário\n`;
        }

        mensagem += `⏰ *Detectado em:* ${new Date().toLocaleString('pt-BR')}`;

        if (config.notificarGrupo) {
            // Notificar no grupo
            await chat.sendMessage(mensagem);
        }

        if (config.notificarAdmins) {
            // Notificar admins por DM
            const admins = await obterAdminsGrupo(grupoId);
            for (const adminId of admins) {
                try {
                    await client.sendMessage(adminId,
                        `${mensagem}\n\n_Esta é uma notificação privada de admin_`
                    );
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Erro ao notificar admin ${adminId}:`, error.message);
                }
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Erro ao notificar:', error.message);
        return false;
    }
}

// Remover membro do grupo
async function removerMembroGrupo(grupoId, membroId) {
    try {
        const chat = await client.getChatById(grupoId);
        await chat.removeParticipants([membroId]);
        console.log(`✅ Membro ${membroId} removido do grupo`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao remover membro:', error.message);
        return false;
    }
}

// Verificação diária de concorrentes em todos os grupos
async function verificacaoDiariaGrupos() {
    console.log('\n🕐 === VERIFICAÇÃO DIÁRIA AUTOMÁTICA INICIADA ===');
    console.log(`⏰ Horário: ${new Date().toLocaleString('pt-BR')}\n`);

    try {
        const chats = await client.getChats();
        const grupos = chats.filter(chat => chat.isGroup);

        console.log(`👥 Verificando ${grupos.length} grupos...\n`);

        let totalConcorrentesEncontrados = 0;
        let totalRemovidos = 0;
        let totalProtegidos = 0;

        for (const grupo of grupos) {
            const grupoId = grupo.id._serialized;
            const grupoNome = grupo.name;
            const participantes = grupo.participants;

            console.log(`📍 Verificando: ${grupoNome}`);

            let concorrentesNoGrupo = [];

            // Verificar cada participante
            for (const participante of participantes) {
                const numeroLimpo = participante.id._serialized.replace('@c.us', '');

                if (isConcorrente(numeroLimpo)) {
                    const isAdminGrupo = participante.isAdmin || participante.isSuperAdmin;

                    // Obter nome do contato
                    let nomeContato = numeroLimpo;
                    try {
                        const contato = await client.getContactById(participante.id._serialized);
                        nomeContato = contato.pushname || contato.name || numeroLimpo;
                    } catch (error) {
                        // Silencioso
                    }

                    concorrentesNoGrupo.push({
                        id: participante.id._serialized,
                        numero: numeroLimpo,
                        nome: nomeContato,
                        isAdmin: isAdminGrupo
                    });
                }
            }

            if (concorrentesNoGrupo.length > 0) {
                console.log(`   🚨 Encontrados ${concorrentesNoGrupo.length} concorrente(s):`);

                for (const concorrente of concorrentesNoGrupo) {
                    totalConcorrentesEncontrados++;

                    console.log(`   - ${concorrente.nome} (${concorrente.numero})`);

                    // Se for admin, apenas notificar
                    if (concorrente.isAdmin) {
                        console.log(`     👑 ADMIN - Apenas notificado (não removido)`);
                        totalProtegidos++;

                        await notificarAdmins(
                            grupoId,
                            grupoNome,
                            concorrente.id,
                            concorrente.nome,
                            true
                        );

                        await registrarDeteccao(
                            grupoId,
                            grupoNome,
                            concorrente.id,
                            concorrente.nome,
                            '⚠️ Verificação diária - Concorrente é ADMIN (não removido)'
                        );
                    }
                    // Se não for admin e remoção automática estiver ativa
                    else if (config.removerAutomatico) {
                        const removido = await removerMembroGrupo(grupoId, concorrente.id);

                        if (removido) {
                            console.log(`     ✅ REMOVIDO automaticamente`);
                            totalRemovidos++;

                            await notificarAdmins(
                                grupoId,
                                grupoNome,
                                concorrente.id,
                                concorrente.nome,
                                false
                            );

                            await registrarDeteccao(
                                grupoId,
                                grupoNome,
                                concorrente.id,
                                concorrente.nome,
                                '🔴 Verificação diária - Removido automaticamente'
                            );
                        } else {
                            console.log(`     ❌ Falha ao remover`);
                        }

                        // Delay entre remoções
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    // Remoção automática desativada
                    else {
                        console.log(`     ⚠️ Apenas notificado (remoção automática desativada)`);

                        await notificarAdmins(
                            grupoId,
                            grupoNome,
                            concorrente.id,
                            concorrente.nome,
                            false
                        );

                        await registrarDeteccao(
                            grupoId,
                            grupoNome,
                            concorrente.id,
                            concorrente.nome,
                            '⚠️ Verificação diária - Apenas notificado'
                        );
                    }
                }
            } else {
                console.log(`   ✅ Grupo limpo`);
            }

            // Delay entre grupos
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n🏁 === VERIFICAÇÃO DIÁRIA CONCLUÍDA ===');
        console.log(`📊 Resumo:`);
        console.log(`   • Grupos verificados: ${grupos.length}`);
        console.log(`   • Concorrentes encontrados: ${totalConcorrentesEncontrados}`);
        console.log(`   • Removidos: ${totalRemovidos}`);
        console.log(`   • Protegidos (admins): ${totalProtegidos}`);
        console.log(`   • Próxima verificação: Amanhã às 00:00\n`);

        // ===== ENVIAR NOTIFICAÇÃO EM CADA GRUPO =====
        if (config.notificarVerificacaoDiaria) {
            console.log('📢 Enviando notificações de conclusão nos grupos...\n');

            for (const grupo of grupos) {
                try {
                    const chat = await client.getChatById(grupo.id._serialized);

                    let mensagem = `🛡️ *VERIFICAÇÃO AUTOMÁTICA CONCLUÍDA*\n\n`;
                    mensagem += `⏰ *Horário:* ${new Date().toLocaleString('pt-BR')}\n`;
                    mensagem += `📊 *Status:* Grupo verificado com sucesso\n\n`;

                    // Mensagem personalizada baseada no resultado
                    const grupoTemConcorrentes = totalConcorrentesEncontrados > 0 &&
                        grupo.participants.some(p => isConcorrente(p.id._serialized.replace('@c.us', '')));

                    if (grupoTemConcorrentes) {
                        mensagem += `⚠️ *Atenção:* Concorrentes detectados neste grupo foram tratados\n`;
                    } else {
                        mensagem += `✅ *Resultado:* Nenhum concorrente detectado neste grupo\n`;
                    }

                    mensagem += `\n🔍 Próxima verificação: Amanhã às 00:00\n`;
                    mensagem += `\n_Bot Detector de Concorrentes - Proteção ativa 24/7_`;

                    await chat.sendMessage(mensagem);
                    console.log(`   ✅ Notificação enviada: ${grupo.name}`);

                    // Delay entre envios
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`   ❌ Erro ao notificar grupo ${grupo.name}:`, error.message);
                }
            }

            console.log('\n✅ Todas as notificações enviadas!\n');
        } else {
            console.log('📢 Notificações nos grupos desativadas (config.notificarVerificacaoDiaria = false)\n');
        }

    } catch (error) {
        console.error('❌ Erro na verificação diária:', error.message);
    }
}

// ===================================
// 📱 EVENTOS DO WHATSAPP
// ===================================

// QR Code para autenticação
client.on('qr', (qr) => {
    console.log('📱 Escaneie o QR Code abaixo:\n');
    qrcode.generate(qr, { small: true });
    console.log('\n');
});

// Bot pronto
client.on('ready', async () => {
    console.log('✅ Bot conectado e pronto!\n');

    // Carregar dados
    await carregarConcorrentes();
    await carregarLogs();
    await carregarConfig();
    await carregarGruposColeta();

    // Listar grupos
    const chats = await client.getChats();
    const grupos = chats.filter(chat => chat.isGroup);

    console.log(`\n👥 Monitorando ${grupos.length} grupos:`);
    grupos.forEach((grupo, index) => {
        console.log(`   ${index + 1}. ${grupo.name}`);
    });

    console.log('\n🔍 Detector ativo! Aguardando novos membros...\n');
    console.log('📋 Comandos disponíveis:');
    console.log('   .status - Status do detector');
    console.log('   .scan - Escanear membros do grupo');
    console.log('   .verificar - Verificação completa em todos os grupos');
    console.log('   .ban - Banir membro (responda à mensagem dele)');
    console.log('   .a - Abrir grupo (todos podem enviar mensagens)');
    console.log('   .f [motivo] - Fechar grupo (apenas admins podem enviar)');
    console.log('   .todos [mensagem] - Mencionar todos os membros');
    console.log('   .addgrupo - Adicionar TODOS os membros do grupo à lista');
    console.log('   .concorrentes - Lista de concorrentes');
    console.log('   .add <número> - Adicionar concorrente');
    console.log('   .remove <número> - Remover concorrente');
    console.log('   .deteccoes - Histórico de detecções');
    console.log('   .config - Ver/alterar configurações');
    console.log('   .ajuda - Ajuda completa\n');

    // ===== COLETA AUTOMÁTICA NO STARTUP =====
    // Coletar membros dos grupos configurados assim que o bot inicia
    if (gruposColeta.size > 0) {
        console.log('🚀 Iniciando coleta automática dos grupos configurados...\n');

        for (const grupo of grupos) {
            if (gruposColeta.has(grupo.name)) {
                console.log(`📥 Coletando: ${grupo.name}`);

                try {
                    const participantes = grupo.participants;

                    if (!participantes || participantes.length === 0) {
                        console.log(`   ⚠️ Nenhum participante encontrado\n`);
                        continue;
                    }

                    let novosAdicionados = 0;
                    let jaExistiam = 0;

                    // Adicionar cada participante
                    for (const participante of participantes) {
                        const numeroLimpo = participante.id._serialized.replace('@c.us', '');

                        if (concorrentes.has(numeroLimpo)) {
                            jaExistiam++;
                        } else {
                            await adicionarConcorrente(numeroLimpo);
                            novosAdicionados++;
                        }
                    }

                    console.log(`   ✅ Concluído!`);
                    console.log(`   📊 Total membros: ${participantes.length}`);
                    console.log(`   ➕ Novos: ${novosAdicionados}`);
                    console.log(`   ⚠️  Já existiam: ${jaExistiam}`);
                    console.log(`   📈 Total na lista: ${concorrentes.size}\n`);

                } catch (error) {
                    console.error(`   ❌ Erro ao coletar: ${error.message}\n`);
                }

                // Pequeno delay entre grupos
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('✅ Coleta automática inicial concluída!\n');
    }

    // ===== AGENDAR VERIFICAÇÃO DIÁRIA ÀS 00:00 =====
    cron.schedule('0 0 * * *', async () => {
        console.log('\n⏰ Agendamento disparado - Iniciando verificação diária...');
        await verificacaoDiariaGrupos();
    }, {
        timezone: "America/Sao_Paulo"
    });

    console.log('📅 Verificação diária agendada para 00:00 (horário de Brasília)\n');
});

// Detectar quando alguém entra no grupo
client.on('group_join', async (notification) => {
    try {
        const chat = await notification.getChat();
        const grupoId = chat.id._serialized;
        const grupoNome = chat.name;

        // IDs dos novos membros
        const novosMembroIds = notification.recipientIds || [notification.id.participant];

        for (const membroId of novosMembroIds) {
            const numeroLimpo = membroId.replace('@c.us', '');

            // Verificar se é concorrente
            if (isConcorrente(numeroLimpo)) {
                // Verificar se é admin do grupo (ADMINS SÃO ISENTOS!)
                const participante = chat.participants.find(p => p.id._serialized === membroId);
                const isAdminGrupo = participante && (participante.isAdmin || participante.isSuperAdmin);

                // Obter informações do contato
                let nomeContato = numeroLimpo;
                try {
                    const contato = await client.getContactById(membroId);
                    nomeContato = contato.pushname || contato.name || numeroLimpo;
                } catch (error) {
                    console.error('Erro ao obter nome do contato:', error.message);
                }

                // Notificar
                await notificarAdmins(grupoId, grupoNome, membroId, nomeContato, isAdminGrupo);

                // Remover APENAS se não for admin
                let acaoTomada = 'Notificação enviada aos admins';

                if (isAdminGrupo) {
                    acaoTomada = '⚠️ Concorrente é ADMIN - Apenas notificado (não removido)';
                    console.log(`⚠️ ${nomeContato} é ADMIN do grupo - NÃO será removido`);
                } else if (config.removerAutomatico) {
                    const removido = await removerMembroGrupo(grupoId, membroId);
                    if (removido) {
                        acaoTomada = 'Removido automaticamente + Notificação';
                    }
                }

                // Registrar detecção
                await registrarDeteccao(grupoId, grupoNome, membroId, nomeContato, acaoTomada);
            }
        }
    } catch (error) {
        console.error('❌ Erro no event group_join:', error.message);
    }
});

// Processar mensagens (comandos admin)
client.on('message', async (message) => {
    try {
        // Ignorar mensagens de status
        if (message.from === 'status@broadcast') return;

        const chat = await message.getChat();

        // ===== COLETA AUTOMÁTICA EM GRUPOS ESPECÍFICOS =====
        // Quando qualquer mensagem é enviada em um grupo da lista,
        // coleta todos os membros automaticamente (apenas uma vez por dia)
        if (chat.isGroup && gruposColeta.has(chat.name)) {
            // Verificar se já coletou hoje
            const hoje = new Date().toDateString();
            const cacheKey = `coleta_${chat.id._serialized}`;

            if (!global.coletasRealizadas) {
                global.coletasRealizadas = {};
            }

            if (global.coletasRealizadas[cacheKey] !== hoje) {
                console.log(`\n📥 Grupo detectado para coleta: ${chat.name}`);
                console.log(`⏳ Coletando membros automaticamente...\n`);

                try {
                    const participantes = chat.participants;
                    let novosAdicionados = 0;
                    let jaExistiam = 0;

                    // Adicionar cada participante
                    for (const participante of participantes) {
                        const numeroLimpo = participante.id._serialized.replace('@c.us', '');

                        if (concorrentes.has(numeroLimpo)) {
                            jaExistiam++;
                        } else {
                            await adicionarConcorrente(numeroLimpo);
                            novosAdicionados++;
                        }
                    }

                    // Marcar como coletado hoje
                    global.coletasRealizadas[cacheKey] = hoje;

                    // Log detalhado
                    console.log(`✅ Coleta automática concluída!`);
                    console.log(`   Grupo: ${chat.name}`);
                    console.log(`   Total membros: ${participantes.length}`);
                    console.log(`   Novos adicionados: ${novosAdicionados}`);
                    console.log(`   Já existiam: ${jaExistiam}`);
                    console.log(`   Total na lista agora: ${concorrentes.size}\n`);

                } catch (error) {
                    console.error('❌ Erro na coleta automática:', error.message);
                }
            }
        }

        // Apenas comandos que começam com .
        if (!message.body.startsWith('.')) return;

        const mensagemTexto = message.body.trim();

        const comando = message.body.toLowerCase().split(' ')[0];
        const args = message.body.split(' ').slice(1);

        // Verificar se é admin (apenas em grupos)
        let isAdmin = false;
        if (chat.isGroup) {
            const autor = await message.getContact();
            const participant = chat.participants.find(p => p.id._serialized === autor.id._serialized);
            isAdmin = participant && (participant.isAdmin || participant.isSuperAdmin);
        } else {
            // Em DM, todos podem usar comandos
            isAdmin = true;
        }

        // ===== COMANDO: .status =====
        if (comando === '.status') {
            const chats = await client.getChats();
            const grupos = chats.filter(c => c.isGroup);

            let resposta = `📊 *STATUS DO DETECTOR*\n\n`;
            resposta += `✅ Status: Ativo\n`;
            resposta += `📱 Concorrentes cadastrados: ${concorrentes.size}\n`;
            resposta += `👥 Grupos monitorados: ${grupos.length}\n`;
            resposta += `🚨 Detecções totais: ${deteccoesLog.length}\n`;
            resposta += `⏰ Online desde: ${new Date().toLocaleString('pt-BR')}\n\n`;
            resposta += `⚙️ *Configurações:*\n`;
            resposta += `   • Notificar admins: ${config.notificarAdmins ? '✅' : '❌'}\n`;
            resposta += `   • Notificar grupo: ${config.notificarGrupo ? '✅' : '❌'}\n`;
            resposta += `   • Remover automático: ${config.removerAutomatico ? '✅' : '❌'}`;

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .concorrentes =====
        if (comando === '.concorrentes') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (concorrentes.size === 0) {
                await message.reply('📋 Nenhum concorrente cadastrado ainda');
                return;
            }

            const lista = [...concorrentes];
            const total = lista.length;
            const limite = 50; // Mostrar apenas primeiros 50

            let resposta = `📋 *LISTA DE CONCORRENTES*\n\n`;
            resposta += `Total: ${total} números\n\n`;

            lista.slice(0, limite).forEach((num, index) => {
                resposta += `${index + 1}. ${num}\n`;
            });

            if (total > limite) {
                resposta += `\n... e mais ${total - limite} números\n`;
            }

            resposta += `\n💾 Lista completa em: competitors.json`;

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .add =====
        if (comando === '.add') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (args.length === 0) {
                await message.reply('❌ Uso: .add <número>\nExemplo: .add 258841234567');
                return;
            }

            const numero = args[0].replace(/\D/g, ''); // Remove tudo que não é número

            if (concorrentes.has(numero)) {
                await message.reply(`⚠️ Número ${numero} já está na lista`);
                return;
            }

            // Adicionar à lista
            await adicionarConcorrente(numero);
            await message.reply(`✅ Concorrente adicionado!\n📱 ${numero}\n\n⏳ Verificando grupos e removendo automaticamente...`);

            // Buscar e remover de todos os grupos
            try {
                const chats = await client.getChats();
                const grupos = chats.filter(c => c.isGroup);

                let gruposEncontrados = [];
                let removidos = 0;
                let protegidos = 0;

                for (const grupo of grupos) {
                    const participante = grupo.participants.find(p =>
                        p.id._serialized.replace('@c.us', '') === numero
                    );

                    if (participante) {
                        const isAdminGrupo = participante.isAdmin || participante.isSuperAdmin;

                        // Obter nome do contato
                        let nomeContato = numero;
                        try {
                            const contato = await client.getContactById(participante.id._serialized);
                            nomeContato = contato.pushname || contato.name || numero;
                        } catch (error) {
                            // Silencioso
                        }

                        if (isAdminGrupo) {
                            // É admin - apenas notificar
                            protegidos++;
                            gruposEncontrados.push({
                                nome: grupo.name,
                                acao: '👑 ADMIN (não removido)'
                            });

                            await notificarAdmins(
                                grupo.id._serialized,
                                grupo.name,
                                participante.id._serialized,
                                nomeContato,
                                true
                            );

                            await registrarDeteccao(
                                grupo.id._serialized,
                                grupo.name,
                                participante.id._serialized,
                                nomeContato,
                                '⚠️ Adicionado via .add - É ADMIN (não removido)'
                            );
                        } else if (config.removerAutomatico) {
                            // Remover automaticamente
                            const removido = await removerMembroGrupo(grupo.id._serialized, participante.id._serialized);

                            if (removido) {
                                removidos++;
                                gruposEncontrados.push({
                                    nome: grupo.name,
                                    acao: '✅ Removido'
                                });

                                await notificarAdmins(
                                    grupo.id._serialized,
                                    grupo.name,
                                    participante.id._serialized,
                                    nomeContato,
                                    false
                                );

                                await registrarDeteccao(
                                    grupo.id._serialized,
                                    grupo.name,
                                    participante.id._serialized,
                                    nomeContato,
                                    '🔴 Adicionado via .add - Removido automaticamente'
                                );

                                // Delay entre remoções
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            } else {
                                gruposEncontrados.push({
                                    nome: grupo.name,
                                    acao: '❌ Falha ao remover'
                                });
                            }
                        } else {
                            // Remoção automática desativada
                            gruposEncontrados.push({
                                nome: grupo.name,
                                acao: '⚠️ Encontrado (remoção desativada)'
                            });

                            await notificarAdmins(
                                grupo.id._serialized,
                                grupo.name,
                                participante.id._serialized,
                                nomeContato,
                                false
                            );

                            await registrarDeteccao(
                                grupo.id._serialized,
                                grupo.name,
                                participante.id._serialized,
                                nomeContato,
                                '⚠️ Adicionado via .add - Apenas notificado (remoção desativada)'
                            );
                        }
                    }
                }

                // Relatório final
                let relatorio = `\n📊 *RELATÓRIO DE VERIFICAÇÃO*\n\n`;
                relatorio += `📱 Número: ${numero}\n`;
                relatorio += `👥 Grupos verificados: ${grupos.length}\n`;
                relatorio += `🚨 Encontrado em: ${gruposEncontrados.length} grupo(s)\n`;

                if (gruposEncontrados.length > 0) {
                    relatorio += `\n*Detalhes:*\n`;
                    gruposEncontrados.forEach((g, index) => {
                        relatorio += `${index + 1}. ${g.nome}\n   ${g.acao}\n`;
                    });

                    relatorio += `\n📊 *Resumo:*\n`;
                    relatorio += `   • Removidos: ${removidos}\n`;
                    relatorio += `   • Protegidos (admins): ${protegidos}\n`;
                } else {
                    relatorio += `\n✅ Este número não está presente em nenhum grupo monitorado`;
                }

                relatorio += `\n\n💾 Total na lista: ${concorrentes.size} números`;

                await message.reply(relatorio);

            } catch (error) {
                console.error('❌ Erro ao verificar grupos:', error.message);
                await message.reply('❌ Erro ao verificar grupos. Número foi adicionado mas verificação falhou.');
            }

            return;
        }

        // ===== COMANDO: .remove =====
        if (comando === '.remove') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (args.length === 0) {
                await message.reply('❌ Uso: .remove <número>\nExemplo: .remove 258841234567');
                return;
            }

            const numero = args[0].replace(/\D/g, '');
            const removido = await removerConcorrente(numero);

            if (removido) {
                await message.reply(`✅ Concorrente removido!\n📱 ${numero}\n\nTotal: ${concorrentes.size} números`);
            } else {
                await message.reply(`⚠️ Número ${numero} não estava na lista`);
            }
            return;
        }

        // ===== COMANDO: .ban =====
        if (comando === '.ban') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (!chat.isGroup) {
                await message.reply('❌ Este comando só funciona em grupos');
                return;
            }

            // Verificar se a mensagem é uma resposta
            if (!message.hasQuotedMsg) {
                await message.reply('❌ Você precisa responder à mensagem da pessoa que deseja banir\n\n*Como usar:*\nResponda à mensagem do membro e digite `.ban`');
                return;
            }

            try {
                // Obter a mensagem respondida
                const quotedMsg = await message.getQuotedMessage();

                // Obter o author da mensagem respondida
                let membroId = chat.isGroup ? quotedMsg.author : quotedMsg.from;
                let participante = null;

                // Se for @lid, precisamos encontrar o participante de forma diferente
                if (membroId && membroId.includes('@lid')) {
                    // Tentar encontrar pelo contato diretamente
                    try {
                        const contact = await quotedMsg.getContact();
                        if (contact && contact.id && contact.id._serialized) {
                            membroId = contact.id._serialized;
                            participante = chat.participants.find(p => p.id._serialized === membroId);
                        }
                    } catch (error) {
                        console.log('⚠️ Erro ao obter contato do LID');
                    }

                    // Se ainda não encontrou, tentar buscar nos participantes
                    if (!participante) {
                        // Buscar por todos os participantes que podem corresponder
                        participante = chat.participants.find(p => {
                            // Comparar o LID diretamente
                            return p.id._serialized === membroId ||
                                   p.id.user === membroId.split('@')[0];
                        });
                    }
                } else {
                    // Número normal @c.us - buscar diretamente
                    participante = chat.participants.find(p => p.id._serialized === membroId);
                }

                // Obter ID do bot
                const botNumber = client.info.wid._serialized;

                // Verificar se não está tentando banir o bot
                if (membroId === botNumber) {
                    await message.reply('❌ Não é possível banir o próprio bot');
                    return;
                }

                if (!participante) {
                    await message.reply('❌ Membro não encontrado no grupo');
                    return;
                }

                // Verificar se o membro é admin
                const isMembroAdmin = participante.isAdmin || participante.isSuperAdmin;

                if (isMembroAdmin) {
                    await message.reply('❌ Não é possível banir administradores do grupo\n\n🛡️ *Proteção ativa:* Admins não podem ser removidos pelo bot');
                    return;
                }

                // Obter informações do contato
                const numeroLimpo = membroId.replace('@c.us', '');
                let nomeContato = numeroLimpo;
                try {
                    const contato = await client.getContactById(membroId);
                    nomeContato = contato.pushname || contato.name || numeroLimpo;
                } catch (error) {
                    // Silencioso
                }

                // Perguntar se deseja adicionar à lista de concorrentes
                let adicionarNaLista = false;
                if (args.length > 0 && args[0].toLowerCase() === 'add') {
                    adicionarNaLista = true;
                }

                // Remover do grupo
                const removido = await removerMembroGrupo(chat.id._serialized, membroId);

                if (removido) {
                    let respostaBan = `✅ *MEMBRO BANIDO*\n\n`;
                    respostaBan += `👤 *Nome:* ${nomeContato}\n`;
                    respostaBan += `📱 *Número:* ${numeroLimpo}\n`;
                    respostaBan += `📍 *Grupo:* ${chat.name}\n`;
                    respostaBan += `⚡ *Ação:* Removido do grupo\n`;

                    // Se solicitado, adicionar à lista de concorrentes
                    if (adicionarNaLista) {
                        if (!concorrentes.has(numeroLimpo)) {
                            await adicionarConcorrente(numeroLimpo);
                            respostaBan += `\n📋 *Adicionado à lista de concorrentes*\n`;
                            respostaBan += `🔴 Este número será bloqueado em TODOS os grupos`;
                        } else {
                            respostaBan += `\n⚠️ *Já estava na lista de concorrentes*`;
                        }
                    } else {
                        respostaBan += `\n💡 *Dica:* Use \`.ban add\` para adicionar à lista de concorrentes`;
                    }

                    await message.reply(respostaBan);

                    // Registrar no log
                    await registrarDeteccao(
                        chat.id._serialized,
                        chat.name,
                        membroId,
                        nomeContato,
                        adicionarNaLista ?
                            `🔨 Banido via .ban + adicionado à lista de concorrentes` :
                            `🔨 Banido via .ban (não adicionado à lista)`
                    );

                    console.log(`\n🔨 MEMBRO BANIDO VIA COMANDO`);
                    console.log(`📍 Grupo: ${chat.name}`);
                    console.log(`📱 Número: ${numeroLimpo}`);
                    console.log(`👤 Nome: ${nomeContato}`);
                    console.log(`📋 Adicionado à lista: ${adicionarNaLista ? 'SIM' : 'NÃO'}\n`);

                } else {
                    await message.reply('❌ Erro ao remover membro. Verifique se o bot tem permissões de administrador.');
                }

            } catch (error) {
                console.error('❌ Erro no comando .ban:', error.message);
                await message.reply('❌ Erro ao executar comando. Tente novamente.');
            }

            return;
        }

        // ===== COMANDO: .a (ABRIR GRUPO) =====
        if (comando === '.a') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (!chat.isGroup) {
                await message.reply('❌ Este comando só funciona em grupos');
                return;
            }

            try {
                // Abrir o grupo (permitir que qualquer um envie mensagens)
                await chat.setMessagesAdminsOnly(false);

                await message.reply('✅ *GRUPO ABERTO*\n\n🔓 Todos os membros podem enviar mensagens agora');

                console.log(`\n🔓 GRUPO ABERTO`);
                console.log(`📍 Grupo: ${chat.name}`);
                console.log(`👨‍💼 Por: ${(await message.getContact()).pushname || 'Admin'}\n`);

            } catch (error) {
                console.error('❌ Erro ao abrir grupo:', error.message);
                await message.reply('❌ Erro ao abrir o grupo. Verifique se o bot tem permissões de administrador.');
            }

            return;
        }

        // ===== COMANDO: .f (FECHAR GRUPO) =====
        if (comando === '.f') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (!chat.isGroup) {
                await message.reply('❌ Este comando só funciona em grupos');
                return;
            }

            try {
                // Fechar o grupo (apenas admins podem enviar mensagens)
                await chat.setMessagesAdminsOnly(true);

                // Obter o motivo (tudo após o comando .f)
                const motivo = args.join(' ').trim();

                let respostaFechamento = '🔒 *GRUPO FECHADO*\n\n';
                respostaFechamento += '⚠️ Apenas administradores podem enviar mensagens agora';

                if (motivo) {
                    respostaFechamento += `\n\n📝 *Motivo:*\n_${motivo}_`;
                }

                await message.reply(respostaFechamento);

                console.log(`\n🔒 GRUPO FECHADO`);
                console.log(`📍 Grupo: ${chat.name}`);
                console.log(`👨‍💼 Por: ${(await message.getContact()).pushname || 'Admin'}`);
                if (motivo) {
                    console.log(`📝 Motivo: ${motivo}`);
                }
                console.log('');

            } catch (error) {
                console.error('❌ Erro ao fechar grupo:', error.message);
                await message.reply('❌ Erro ao fechar o grupo. Verifique se o bot tem permissões de administrador.');
            }

            return;
        }

        // ===== COMANDO: .todos (MENCIONAR TODOS) =====
        if (comando === '.todos' || comando === '.everyone' || comando === '.all') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (!chat.isGroup) {
                await message.reply('❌ Este comando só funciona em grupos');
                return;
            }

            try {
                // Obter todos os participantes do grupo
                const participantes = chat.participants.map(p => p.id._serialized);

                // Obter mensagem personalizada (tudo após o comando)
                const mensagemPersonalizada = args.join(' ').trim();

                let mensagemFinal = '📢 *ATENÇÃO GERAL* 📢\n\n';

                if (mensagemPersonalizada) {
                    mensagemFinal += mensagemPersonalizada;
                } else {
                    mensagemFinal += 'Todos foram mencionados!';
                }

                // Enviar mensagem mencionando todos
                await chat.sendMessage(mensagemFinal, {
                    mentions: participantes
                });

                console.log(`\n📢 MENÇÃO EM MASSA`);
                console.log(`📍 Grupo: ${chat.name}`);
                console.log(`👥 Mencionados: ${participantes.length} pessoas`);
                console.log(`👨‍💼 Por: ${(await message.getContact()).pushname || 'Admin'}`);
                if (mensagemPersonalizada) {
                    console.log(`💬 Mensagem: ${mensagemPersonalizada}`);
                }
                console.log('');

            } catch (error) {
                console.error('❌ Erro ao mencionar todos:', error.message);
                await message.reply('❌ Erro ao mencionar todos. Tente novamente.');
            }

            return;
        }

        // ===== COMANDO: .coletar (invisível - deleta a mensagem) =====
        if (comando === '.coletar' || comando === '.c') {
            if (!chat.isGroup) {
                // Deletar comando em DM também
                try {
                    await message.delete(true);
                } catch (error) {
                    console.error('Erro ao deletar mensagem:', error.message);
                }
                return;
            }

            // Deletar a mensagem do comando imediatamente
            try {
                await message.delete(true); // true = deletar para todos
            } catch (error) {
                console.error('⚠️ Não foi possível deletar a mensagem (talvez não seja admin)');
            }

            try {
                const grupoNome = chat.name;
                const participantes = chat.participants;

                let novosAdicionados = 0;
                let jaExistiam = 0;
                let membrosAdicionados = [];

                // Adicionar cada participante
                for (const participante of participantes) {
                    const numeroLimpo = participante.id._serialized.replace('@c.us', '');

                    // Verificar se já existe
                    if (concorrentes.has(numeroLimpo)) {
                        jaExistiam++;
                    } else {
                        // Adicionar à lista
                        await adicionarConcorrente(numeroLimpo);
                        novosAdicionados++;

                        // Obter nome do contato
                        let nomeContato = numeroLimpo;
                        try {
                            const contato = await client.getContactById(participante.id._serialized);
                            nomeContato = contato.pushname || contato.name || numeroLimpo;
                        } catch (error) {
                            console.error('Erro ao obter nome:', error.message);
                        }

                        membrosAdicionados.push({
                            numero: numeroLimpo,
                            nome: nomeContato
                        });
                    }
                }

                // Log detalhado (apenas no servidor - SEM resposta no WhatsApp)
                console.log(`\n📥 COLETAR executado em: ${grupoNome}`);
                console.log(`   Total membros: ${participantes.length}`);
                console.log(`   Novos adicionados: ${novosAdicionados}`);
                console.log(`   Já existiam: ${jaExistiam}`);
                console.log(`   Total na lista agora: ${concorrentes.size}`);

                if (novosAdicionados > 0 && membrosAdicionados.length <= 20) {
                    console.log(`\n   Membros adicionados:`);
                    membrosAdicionados.forEach((m, index) => {
                        console.log(`   ${index + 1}. ${m.nome} (${m.numero})`);
                    });
                } else if (novosAdicionados > 20) {
                    console.log(`\n   Primeiros 20 adicionados:`);
                    membrosAdicionados.slice(0, 20).forEach((m, index) => {
                        console.log(`   ${index + 1}. ${m.nome} (${m.numero})`);
                    });
                    console.log(`   ... e mais ${novosAdicionados - 20} números`);
                }

            } catch (error) {
                console.error('❌ Erro ao coletar membros:', error.message);
            }

            return;
        }

        // ===== COMANDO: .addgrupo =====
        if (comando === '.addgrupo') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (!chat.isGroup) {
                await message.reply('❌ Este comando só funciona em grupos');
                return;
            }

            await message.reply('📥 Coletando todos os membros do grupo...\n⏳ Aguarde...');

            try {
                const grupoNome = chat.name;
                const participantes = chat.participants;

                let novosAdicionados = 0;
                let jaExistiam = 0;
                let membrosAdicionados = [];

                // Adicionar cada participante
                for (const participante of participantes) {
                    const numeroLimpo = participante.id._serialized.replace('@c.us', '');

                    // Verificar se já existe
                    if (concorrentes.has(numeroLimpo)) {
                        jaExistiam++;
                    } else {
                        // Adicionar à lista
                        await adicionarConcorrente(numeroLimpo);
                        novosAdicionados++;

                        // Obter nome do contato
                        let nomeContato = numeroLimpo;
                        try {
                            const contato = await client.getContactById(participante.id._serialized);
                            nomeContato = contato.pushname || contato.name || numeroLimpo;
                        } catch (error) {
                            console.error('Erro ao obter nome:', error.message);
                        }

                        membrosAdicionados.push({
                            numero: numeroLimpo,
                            nome: nomeContato
                        });
                    }
                }

                // Log detalhado (apenas no servidor - SEM resposta no WhatsApp)
                console.log(`\n📥 ADDGRUPO executado em: ${grupoNome}`);
                console.log(`   Total membros: ${participantes.length}`);
                console.log(`   Novos adicionados: ${novosAdicionados}`);
                console.log(`   Já existiam: ${jaExistiam}`);
                console.log(`   Total na lista agora: ${concorrentes.size}`);

                if (novosAdicionados > 0 && membrosAdicionados.length <= 20) {
                    console.log(`\n   Membros adicionados:`);
                    membrosAdicionados.forEach((m, index) => {
                        console.log(`   ${index + 1}. ${m.nome} (${m.numero})`);
                    });
                } else if (novosAdicionados > 20) {
                    console.log(`\n   Primeiros 20 adicionados:`);
                    membrosAdicionados.slice(0, 20).forEach((m, index) => {
                        console.log(`   ${index + 1}. ${m.nome} (${m.numero})`);
                    });
                    console.log(`   ... e mais ${novosAdicionados - 20} números`);
                }

            } catch (error) {
                console.error('❌ Erro ao adicionar grupo:', error.message);
                await message.reply('❌ Erro ao adicionar membros. Tente novamente.');
            }

            return;
        }

        // ===== COMANDO: .scan =====
        if (comando === '.scan') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (!chat.isGroup) {
                await message.reply('❌ Este comando só funciona em grupos');
                return;
            }

            await message.reply('🔍 Escaneando membros do grupo...\n⏳ Aguarde...');

            try {
                const grupoNome = chat.name;
                const participantes = chat.participants;

                let concorrentesEncontrados = [];

                // Verificar cada participante
                for (const participante of participantes) {
                    const numeroLimpo = participante.id._serialized.replace('@c.us', '');

                    if (isConcorrente(numeroLimpo)) {
                        // Obter nome do contato
                        let nomeContato = numeroLimpo;
                        try {
                            const contato = await client.getContactById(participante.id._serialized);
                            nomeContato = contato.pushname || contato.name || numeroLimpo;
                        } catch (error) {
                            console.error('Erro ao obter nome:', error.message);
                        }

                        concorrentesEncontrados.push({
                            numero: numeroLimpo,
                            nome: nomeContato,
                            id: participante.id._serialized,
                            isAdmin: participante.isAdmin || participante.isSuperAdmin
                        });
                    }
                }

                // Preparar resposta
                let resposta = `🔍 *SCAN COMPLETO*\n\n`;
                resposta += `📍 *Grupo:* ${grupoNome}\n`;
                resposta += `👥 *Total de membros:* ${participantes.length}\n`;
                resposta += `🚨 *Concorrentes encontrados:* ${concorrentesEncontrados.length}\n\n`;

                if (concorrentesEncontrados.length === 0) {
                    resposta += `✅ *Nenhum concorrente detectado neste grupo!*\n\n`;
                    resposta += `_Grupo limpo e seguro_ 🛡️`;
                } else {
                    resposta += `⚠️ *ATENÇÃO: Concorrentes detectados!*\n\n`;

                    concorrentesEncontrados.forEach((c, index) => {
                        resposta += `${index + 1}. *${c.nome}*\n`;
                        resposta += `   📱 ${c.numero}\n`;
                        resposta += `   👑 ${c.isAdmin ? '⚠️ ADMIN (protegido)' : 'Membro'}\n\n`;
                    });

                    resposta += `\n⚡ *Ações recomendadas:*\n`;
                    resposta += `• Verificar cada pessoa\n`;
                    resposta += `• Remover membros se necessário\n`;
                    resposta += `• 🛡️ Admins NÃO serão removidos automaticamente\n`;
                    resposta += `• Ativar remoção automática: .config remover on`;
                }

                await message.reply(resposta);

                // Log da varredura
                console.log(`\n🔍 SCAN realizado em: ${grupoNome}`);
                console.log(`   Total membros: ${participantes.length}`);
                console.log(`   Concorrentes: ${concorrentesEncontrados.length}`);
                if (concorrentesEncontrados.length > 0) {
                    concorrentesEncontrados.forEach(c => {
                        console.log(`   - ${c.nome} (${c.numero})`);
                    });
                }

            } catch (error) {
                console.error('❌ Erro ao executar scan:', error.message);
                await message.reply('❌ Erro ao escanear grupo. Tente novamente.');
            }

            return;
        }

        // ===== COMANDO: .verificar =====
        if (comando === '.verificar') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            await message.reply('🔍 Iniciando verificação completa de todos os grupos...\n⏳ Isso pode levar alguns minutos...');

            try {
                await verificacaoDiariaGrupos();
                await message.reply('✅ Verificação completa finalizada!\n\n📊 Verifique o console para ver o relatório detalhado.');
            } catch (error) {
                console.error('❌ Erro ao executar verificação:', error.message);
                await message.reply('❌ Erro ao executar verificação. Tente novamente.');
            }

            return;
        }

        // ===== COMANDO: .deteccoes =====
        if (comando === '.deteccoes' || comando === '.detecoes') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (deteccoesLog.length === 0) {
                await message.reply('📋 Nenhuma detecção registrada ainda');
                return;
            }

            const limite = 10;
            let resposta = `🚨 *HISTÓRICO DE DETECÇÕES*\n\n`;
            resposta += `Total: ${deteccoesLog.length} detecções\n\n`;

            deteccoesLog.slice(0, limite).forEach((det, index) => {
                resposta += `${index + 1}. *${det.nomeContato}*\n`;
                resposta += `   📱 ${det.numeroDetectado.replace('@c.us', '')}\n`;
                resposta += `   📍 ${det.grupoNome}\n`;
                resposta += `   ⏰ ${det.data}\n`;
                resposta += `   ⚡ ${det.acaoTomada}\n\n`;
            });

            if (deteccoesLog.length > limite) {
                resposta += `... e mais ${deteccoesLog.length - limite} detecções\n`;
            }

            resposta += `\n💾 Log completo em: detections-log.json`;

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .config =====
        if (comando === '.config') {
            if (!isAdmin) {
                await message.reply('❌ Apenas administradores podem usar este comando');
                return;
            }

            if (args.length === 0) {
                // Mostrar configurações atuais
                let resposta = `⚙️ *CONFIGURAÇÕES*\n\n`;
                resposta += `1. Notificar admins (DM): ${config.notificarAdmins ? '✅' : '❌'}\n`;
                resposta += `2. Notificar no grupo: ${config.notificarGrupo ? '✅' : '❌'}\n`;
                resposta += `3. Remover automático: ${config.removerAutomatico ? '✅ ATIVO' : '❌ Desativado'}\n`;
                resposta += `4. Notificar verificação diária: ${config.notificarVerificacaoDiaria ? '✅' : '❌'}\n\n`;
                resposta += `*Como alterar:*\n`;
                resposta += `.config admins on/off\n`;
                resposta += `.config grupo on/off\n`;
                resposta += `.config remover on/off\n`;
                resposta += `.config verificacao on/off`;

                await message.reply(resposta);
                return;
            }

            const opcao = args[0].toLowerCase();
            const valor = args[1]?.toLowerCase();

            if (!valor || (valor !== 'on' && valor !== 'off')) {
                await message.reply('❌ Uso: .config <opcao> on/off');
                return;
            }

            const ativar = valor === 'on';

            if (opcao === 'admins') {
                config.notificarAdmins = ativar;
                await salvarConfig();
                await message.reply(`✅ Notificação para admins: ${ativar ? '✅ ATIVADA' : '❌ Desativada'}`);
            } else if (opcao === 'grupo') {
                config.notificarGrupo = ativar;
                await salvarConfig();
                await message.reply(`✅ Notificação no grupo: ${ativar ? '✅ ATIVADA' : '❌ Desativada'}`);
            } else if (opcao === 'remover') {
                config.removerAutomatico = ativar;
                await salvarConfig();
                await message.reply(`✅ Remoção automática: ${ativar ? '🔴 ATIVADA' : '❌ Desativada'}\n\n${ativar ? '⚠️ Concorrentes serão removidos automaticamente!' : ''}`);
            } else if (opcao === 'verificacao') {
                config.notificarVerificacaoDiaria = ativar;
                await salvarConfig();
                await message.reply(`✅ Notificação de verificação diária: ${ativar ? '✅ ATIVADA' : '❌ Desativada'}\n\n${ativar ? '📢 Os grupos receberão notificação após cada verificação diária às 00:00' : '🔕 Os grupos não receberão notificação das verificações diárias'}`);
            } else {
                await message.reply('❌ Opção inválida. Use: admins, grupo, remover ou verificacao');
            }

            return;
        }

        // ===== COMANDO: .ajuda =====
        if (comando === '.ajuda' || comando === '.help') {
            let resposta = `🤖 *BOT DETECTOR DE CONCORRENTES*\n\n`;
            resposta += `*Comandos disponíveis:*\n\n`;
            resposta += `📊 .status\n`;
            resposta += `   Ver status do detector\n\n`;
            resposta += `🔍 .scan\n`;
            resposta += `   Escanear membros atuais do grupo\n\n`;
            resposta += `🕐 .verificar\n`;
            resposta += `   Executar verificação completa em todos os grupos\n\n`;
            resposta += `🔨 .ban\n`;
            resposta += `   Banir membro (responda à mensagem dele)\n`;
            resposta += `   Use .ban add para adicionar à lista\n\n`;
            resposta += `🔓 .a\n`;
            resposta += `   Abrir grupo (todos podem enviar mensagens)\n\n`;
            resposta += `🔒 .f [motivo]\n`;
            resposta += `   Fechar grupo (apenas admins podem enviar)\n`;
            resposta += `   Exemplo: .f Voltamos Brevemente\n\n`;
            resposta += `📢 .todos [mensagem]\n`;
            resposta += `   Mencionar todos os membros do grupo\n`;
            resposta += `   Exemplo: .todos Reunião às 15h!\n\n`;
            resposta += `📥 .addgrupo\n`;
            resposta += `   Adicionar TODOS os membros do grupo à lista\n\n`;
            resposta += `📋 .concorrentes\n`;
            resposta += `   Listar concorrentes cadastrados\n\n`;
            resposta += `➕ .add <número>\n`;
            resposta += `   Adicionar concorrente à lista\n\n`;
            resposta += `➖ .remove <número>\n`;
            resposta += `   Remover concorrente da lista\n\n`;
            resposta += `🚨 .deteccoes\n`;
            resposta += `   Ver histórico de detecções\n\n`;
            resposta += `⚙️ .config [opcao] [on/off]\n`;
            resposta += `   Configurar comportamento\n\n`;
            resposta += `❓ .ajuda\n`;
            resposta += `   Mostrar esta ajuda\n\n`;
            resposta += `*Como funciona:*\n`;
            resposta += `O bot monitora todos os grupos e detecta automaticamente quando um número da lista de concorrentes entra em algum grupo.\n\n`;
            resposta += `🕐 *Verificação automática diária às 00:00*`;

            await message.reply(resposta);
            return;
        }

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error.message);
    }
});

// Erro de autenticação
client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
});

// Desconexão
client.on('disconnected', (reason) => {
    console.log('⚠️  Bot desconectado:', reason);
});

// ===================================
// 🚀 INICIALIZAR BOT
// ===================================

client.initialize();

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
    console.error('❌ Erro não tratado:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exceção não capturada:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando bot...');
    await client.destroy();
    process.exit(0);
});
