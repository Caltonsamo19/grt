require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');

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

// === DADOS EM MEMÓRIA ===
let concorrentes = new Set(); // Lista de números concorrentes
let deteccoesLog = []; // Histórico de detecções
let config = {
    notificarAdmins: true,
    notificarGrupo: true,
    removerAutomatico: false,
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
    console.log('   .concorrentes - Lista de concorrentes');
    console.log('   .add <número> - Adicionar concorrente');
    console.log('   .remove <número> - Remover concorrente');
    console.log('   .deteccoes - Histórico de detecções');
    console.log('   .config - Ver/alterar configurações');
    console.log('   .ajuda - Ajuda completa\n');
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

        // Apenas comandos que começam com .
        if (!message.body.startsWith('.')) return;

        const chat = await message.getChat();
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

            await adicionarConcorrente(numero);
            await message.reply(`✅ Concorrente adicionado!\n📱 ${numero}\n\nTotal: ${concorrentes.size} números`);
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
                resposta += `3. Remover automático: ${config.removerAutomatico ? '✅ ATIVO' : '❌ Desativado'}\n\n`;
                resposta += `*Como alterar:*\n`;
                resposta += `.config admins on/off\n`;
                resposta += `.config grupo on/off\n`;
                resposta += `.config remover on/off`;

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
            } else {
                await message.reply('❌ Opção inválida. Use: admins, grupo ou remover');
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
            resposta += `O bot monitora todos os grupos e detecta automaticamente quando um número da lista de concorrentes entra em algum grupo.`;

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
