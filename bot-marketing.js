require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');

// ===================================
// 📢 BOT DE MARKETING - ENVIO EM MASSA
// ===================================
// Envia mensagens personalizadas para a lista de números
// Com controle anti-ban e relatórios detalhados

console.log('🚀 Iniciando Bot de Marketing...\n');

// === CONFIGURAÇÕES ===
const ARQUIVO_NUMEROS = path.join(__dirname, 'competitors.json');
const ARQUIVO_ENVIADOS = path.join(__dirname, 'enviados-log.json');
const ARQUIVO_CONFIG_MARKETING = path.join(__dirname, 'marketing-config.json');

// === DADOS EM MEMÓRIA ===
let numerosLista = new Set(); // Lista de números para enviar
let enviadosLog = []; // Histórico de envios
let configMarketing = {
    mensagem1: `🚀 *NOVIDADE PARA REVENDEDORES!* 🚀

Você revende pacotes de internet e quer *agilidade* e *praticidade* nas suas compras?

Temos a solução perfeita para você! 💡

✅ *Sistema de Venda AUTOMÁTICA 24/7*
✅ Compra instantânea de megabytes
✅ Sem espera, sem complicação
✅ Atendimento direto e suporte dedicado
✅ Preços competitivos para revenda

🎯 *Junte-se ao nosso grupo exclusivo e revolucione seu negócio!*

Entre agora e comece a comprar de forma *rápida e automatizada*:
👉`,
    linkGrupo: 'https://chat.whatsapp.com/IWEkbY7lGSYEICGgqq4Gwf',
    mensagem2: `📢 *SISTEMA DE VENDA AUTOMÁTICA*

✅ Visite nosso canal do WhatsApp para informações sobre a grande novidade, promoções e atualizações exclusivas!

✅ *Link do Canal:*`,
    linkCanal: 'https://whatsapp.com/channel/0029VbAuXG6AjPXGUXTcOm2k',
    mensagemFinal: `\n_Automatize suas Vendas de Megabytes connosco!_`,
    delayEntreMensagens: 5000, // 5 segundos entre as 2 mensagens (5000ms)
    delayEntreEnvios: 30000, // 30 segundos entre contatos (30000ms)
    delayEntreLotes: 300000, // 5 minutos entre lotes (300000ms)
    tamanhoLote: 20, // 20 mensagens por lote
    horarioInicio: '08:00', // Início do envio
    horarioFim: '22:00', // Fim do envio
    enviarApenasDuranteHorario: true
};

// === INICIALIZAÇÃO DO CLIENT ===
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'bot-marketing',
        dataPath: './.wwebjs_marketing'
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

// Carregar lista de números
async function carregarNumeros() {
    try {
        if (fssync.existsSync(ARQUIVO_NUMEROS)) {
            const data = await fs.readFile(ARQUIVO_NUMEROS, 'utf-8');
            const lista = JSON.parse(data);
            numerosLista = new Set(lista);
            console.log(`✅ ${numerosLista.size} números carregados da lista`);
        } else {
            console.log('⚠️  Arquivo competitors.json não encontrado');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar números:', error.message);
    }
}

// Carregar histórico de envios
async function carregarEnviados() {
    try {
        if (fssync.existsSync(ARQUIVO_ENVIADOS)) {
            const data = await fs.readFile(ARQUIVO_ENVIADOS, 'utf-8');
            enviadosLog = JSON.parse(data);
            console.log(`📋 ${enviadosLog.length} envios anteriores carregados`);
        } else {
            console.log('📋 Nenhum histórico de envios encontrado');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar histórico:', error.message);
    }
}

// Salvar histórico de envios
async function salvarEnviados() {
    try {
        await fs.writeFile(
            ARQUIVO_ENVIADOS,
            JSON.stringify(enviadosLog, null, 2),
            'utf-8'
        );
    } catch (error) {
        console.error('❌ Erro ao salvar histórico:', error.message);
    }
}

// Carregar configurações de marketing
async function carregarConfigMarketing() {
    try {
        if (fssync.existsSync(ARQUIVO_CONFIG_MARKETING)) {
            const data = await fs.readFile(ARQUIVO_CONFIG_MARKETING, 'utf-8');
            configMarketing = { ...configMarketing, ...JSON.parse(data) };
            console.log('⚙️  Configurações de marketing carregadas');
        } else {
            await salvarConfigMarketing();
            console.log('⚙️  Configurações padrão criadas');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar config:', error.message);
    }
}

// Salvar configurações de marketing
async function salvarConfigMarketing() {
    try {
        await fs.writeFile(
            ARQUIVO_CONFIG_MARKETING,
            JSON.stringify(configMarketing, null, 2),
            'utf-8'
        );
    } catch (error) {
        console.error('❌ Erro ao salvar config:', error.message);
    }
}

// ===================================
// 📨 FUNÇÕES DE ENVIO
// ===================================

// Verificar se já foi enviado para este número (por tipo de campanha)
function jaEnviado(numero, tipoCampanha = 'ambos') {
    return enviadosLog.some(log =>
        log.numero === numero &&
        log.status === 'enviado' &&
        log.tipoCampanha === tipoCampanha
    );
}

// Verificar se está dentro do horário permitido
function dentroDoHorario() {
    if (!configMarketing.enviarApenasDuranteHorario) return true;

    const agora = new Date();
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();

    const [horaInicio, minInicio] = configMarketing.horarioInicio.split(':').map(Number);
    const [horaFim, minFim] = configMarketing.horarioFim.split(':').map(Number);

    const minInicio_total = horaInicio * 60 + minInicio;
    const minFim_total = horaFim * 60 + minFim;

    return horaAtual >= minInicio_total && horaAtual <= minFim_total;
}

// Registrar envio
async function registrarEnvio(numero, status, detalhes = '', tipoCampanha = 'ambos') {
    const registro = {
        timestamp: new Date().toISOString(),
        data: new Date().toLocaleString('pt-BR', { timeZone: 'Africa/Maputo' }),
        numero,
        status, // 'enviado', 'falha', 'ja_enviado', 'invalido'
        tipoCampanha, // 'grupo', 'canal', 'ambos'
        detalhes
    };

    enviadosLog.unshift(registro);

    // Manter apenas últimos 10000 registros
    if (enviadosLog.length > 10000) {
        enviadosLog = enviadosLog.slice(0, 10000);
    }

    await salvarEnviados();
    return registro;
}

// Enviar mensagens para um número (grupo, canal ou ambos)
async function enviarMensagens(numero, tipoCampanha = 'ambos') {
    try {
        // Formatar número (adicionar @c.us se necessário)
        const numeroFormatado = numero.includes('@c.us') ? numero : `${numero}@c.us`;

        // Verificar se o número existe
        const contato = await client.getNumberId(numeroFormatado);

        if (!contato) {
            console.log(`   ❌ Número inválido/não existe: ${numero}`);
            await registrarEnvio(numero, 'invalido', 'Número não existe no WhatsApp', tipoCampanha);
            return { sucesso: false, motivo: 'invalido' };
        }

        let mensagensEnviadas = 0;

        // CAMPANHA DE GRUPO ou AMBOS
        if (tipoCampanha === 'grupo' || tipoCampanha === 'ambos') {
            const mensagemCompleta1 = `${configMarketing.mensagem1}\n${configMarketing.linkGrupo}`;
            await client.sendMessage(contato._serialized, mensagemCompleta1);
            mensagensEnviadas++;
            console.log(`   ✅ Mensagem ${mensagensEnviadas} enviada (Grupo): ${numero}`);

            // Se for enviar ambos, aguardar delay
            if (tipoCampanha === 'ambos') {
                await new Promise(resolve => setTimeout(resolve, configMarketing.delayEntreMensagens));
            }
        }

        // CAMPANHA DE CANAL ou AMBOS
        if (tipoCampanha === 'canal' || tipoCampanha === 'ambos') {
            const mensagemCompleta2 = `${configMarketing.mensagem2}\n${configMarketing.linkCanal}${configMarketing.mensagemFinal}`;
            await client.sendMessage(contato._serialized, mensagemCompleta2);
            mensagensEnviadas++;
            console.log(`   ✅ Mensagem ${mensagensEnviadas} enviada (Canal): ${numero}`);
        }

        const detalhes = tipoCampanha === 'ambos'
            ? '2 mensagens enviadas (Grupo + Canal)'
            : tipoCampanha === 'grupo'
            ? 'Mensagem de Grupo enviada'
            : 'Mensagem de Canal enviada';

        await registrarEnvio(numero, 'enviado', detalhes, tipoCampanha);

        return { sucesso: true, mensagensEnviadas };

    } catch (error) {
        console.log(`   ❌ Erro ao enviar para ${numero}: ${error.message}`);
        await registrarEnvio(numero, 'falha', error.message, tipoCampanha);
        return { sucesso: false, motivo: error.message };
    }
}

// Função principal de envio em massa
async function iniciarEnvioMassa(tipoCampanha = 'ambos') {
    const nomeCampanha = tipoCampanha === 'grupo' ? 'GRUPO' :
                        tipoCampanha === 'canal' ? 'CANAL' :
                        'GRUPO + CANAL';

    console.log(`\n📢 ===== INICIANDO CAMPANHA: ${nomeCampanha} =====\n`);

    // Verificar se está no horário permitido
    if (!dentroDoHorario()) {
        console.log(`⏰ Fora do horário permitido (${configMarketing.horarioInicio} - ${configMarketing.horarioFim})`);
        console.log('⏳ Aguardando horário permitido...\n');
        return {
            sucesso: false,
            motivo: 'Fora do horário permitido'
        };
    }

    // Filtrar números que ainda não receberam este tipo de campanha
    const numerosParaEnviar = [...numerosLista].filter(num => !jaEnviado(num, tipoCampanha));

    console.log(`📊 Status:`);
    console.log(`   Total na lista: ${numerosLista.size}`);
    console.log(`   Já enviados: ${numerosLista.size - numerosParaEnviar.length}`);
    console.log(`   Pendentes: ${numerosParaEnviar.length}\n`);

    if (numerosParaEnviar.length === 0) {
        console.log('✅ Todos os números já receberam a mensagem!\n');
        return {
            sucesso: true,
            enviados: 0,
            pendentes: 0
        };
    }

    console.log(`⚙️ Configurações:`);
    console.log(`   Delay entre envios: ${configMarketing.delayEntreEnvios / 1000}s`);
    console.log(`   Tamanho do lote: ${configMarketing.tamanhoLote} mensagens`);
    console.log(`   Delay entre lotes: ${configMarketing.delayEntreLotes / 1000}s`);
    console.log(`   Horário permitido: ${configMarketing.horarioInicio} - ${configMarketing.horarioFim}\n`);

    let totalEnviados = 0;
    let totalFalhas = 0;
    let totalInvalidos = 0;

    // Processar em lotes
    for (let i = 0; i < numerosParaEnviar.length; i++) {
        const numero = numerosParaEnviar[i];
        const posicao = i + 1;
        const percentual = ((posicao / numerosParaEnviar.length) * 100).toFixed(1);

        console.log(`\n📤 [${posicao}/${numerosParaEnviar.length}] (${percentual}%) - Enviando para: ${numero}`);

        // Enviar mensagens conforme tipo de campanha
        const resultado = await enviarMensagens(numero, tipoCampanha);

        if (resultado.sucesso) {
            totalEnviados++;
        } else if (resultado.motivo === 'invalido') {
            totalInvalidos++;
        } else {
            totalFalhas++;
        }

        // Verificar se completou um lote
        const completouLote = (posicao % configMarketing.tamanhoLote === 0) && posicao < numerosParaEnviar.length;

        if (completouLote) {
            console.log(`\n⏸️  Lote de ${configMarketing.tamanhoLote} concluído!`);
            console.log(`   Aguardando ${configMarketing.delayEntreLotes / 1000}s antes do próximo lote...\n`);
            await new Promise(resolve => setTimeout(resolve, configMarketing.delayEntreLotes));

            // Verificar novamente se está no horário
            if (!dentroDoHorario()) {
                console.log(`\n⏰ Saiu do horário permitido. Pausando envios...`);
                console.log(`📊 Resumo parcial:`);
                console.log(`   Enviados: ${totalEnviados}`);
                console.log(`   Falhas: ${totalFalhas}`);
                console.log(`   Inválidos: ${totalInvalidos}`);
                console.log(`   Restantes: ${numerosParaEnviar.length - posicao}\n`);
                return {
                    sucesso: false,
                    motivo: 'Horário expirado',
                    enviados: totalEnviados,
                    falhas: totalFalhas,
                    invalidos: totalInvalidos,
                    restantes: numerosParaEnviar.length - posicao
                };
            }
        } else if (posicao < numerosParaEnviar.length) {
            // Delay normal entre envios
            await new Promise(resolve => setTimeout(resolve, configMarketing.delayEntreEnvios));
        }
    }

    // Relatório final
    console.log('\n🏁 ===== CAMPANHA CONCLUÍDA =====\n');
    console.log(`📊 Resumo Final:`);
    console.log(`   ✅ Enviados com sucesso: ${totalEnviados}`);
    console.log(`   ❌ Falhas: ${totalFalhas}`);
    console.log(`   ⚠️  Números inválidos: ${totalInvalidos}`);
    console.log(`   📱 Total processados: ${numerosParaEnviar.length}\n`);

    return {
        sucesso: true,
        enviados: totalEnviados,
        falhas: totalFalhas,
        invalidos: totalInvalidos,
        total: numerosParaEnviar.length
    };
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
    console.log('✅ Bot de Marketing conectado e pronto!\n');

    // Carregar dados
    await carregarNumeros();
    await carregarEnviados();
    await carregarConfigMarketing();

    console.log('\n📋 Comandos disponíveis:');
    console.log('   .grupo - Campanha APENAS link do grupo');
    console.log('   .canal - Campanha APENAS link do canal');
    console.log('   .ambos - Campanha COMPLETA (grupo + canal)');
    console.log('   .status - Ver status das campanhas');
    console.log('   .config - Ver/alterar configurações');
    console.log('   .mensagem - Ver mensagens configuradas');
    console.log('   .links - Ver/alterar links (grupo e canal)');
    console.log('   .testar <número> - Testar envio para um número');
    console.log('   .relatorio - Ver relatório de envios');
    console.log('   .limpar - Limpar histórico de envios');
    console.log('   .ajuda - Ajuda completa\n');
});

// Processar mensagens (comandos)
client.on('message', async (message) => {
    try {
        // Ignorar mensagens de status
        if (message.from === 'status@broadcast') return;

        // Apenas comandos que começam com .
        if (!message.body.startsWith('.')) return;

        const comando = message.body.toLowerCase().split(' ')[0];
        const args = message.body.split(' ').slice(1);

        // ===== COMANDO: .grupo =====
        if (comando === '.grupo') {
            await message.reply('👥 Iniciando campanha de GRUPO...\n⏳ Aguarde...');

            const resultado = await iniciarEnvioMassa('grupo');

            let resposta = `📊 *RELATÓRIO - CAMPANHA GRUPO*\n\n`;

            if (resultado.sucesso) {
                resposta += `✅ *Status:* Concluída\n\n`;
                resposta += `📈 *Resultados:*\n`;
                resposta += `   • Enviados: ${resultado.enviados}\n`;
                resposta += `   • Falhas: ${resultado.falhas}\n`;
                resposta += `   • Inválidos: ${resultado.invalidos}\n`;
                resposta += `   • Total: ${resultado.total}`;
            } else {
                resposta += `⚠️ *Status:* ${resultado.motivo}\n\n`;
                if (resultado.enviados !== undefined) {
                    resposta += `📈 *Parcial:*\n`;
                    resposta += `   • Enviados: ${resultado.enviados}\n`;
                    resposta += `   • Falhas: ${resultado.falhas}\n`;
                    resposta += `   • Restantes: ${resultado.restantes}`;
                }
            }

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .canal =====
        if (comando === '.canal') {
            await message.reply('📢 Iniciando campanha de CANAL...\n⏳ Aguarde...');

            const resultado = await iniciarEnvioMassa('canal');

            let resposta = `📊 *RELATÓRIO - CAMPANHA CANAL*\n\n`;

            if (resultado.sucesso) {
                resposta += `✅ *Status:* Concluída\n\n`;
                resposta += `📈 *Resultados:*\n`;
                resposta += `   • Enviados: ${resultado.enviados}\n`;
                resposta += `   • Falhas: ${resultado.falhas}\n`;
                resposta += `   • Inválidos: ${resultado.invalidos}\n`;
                resposta += `   • Total: ${resultado.total}`;
            } else {
                resposta += `⚠️ *Status:* ${resultado.motivo}\n\n`;
                if (resultado.enviados !== undefined) {
                    resposta += `📈 *Parcial:*\n`;
                    resposta += `   • Enviados: ${resultado.enviados}\n`;
                    resposta += `   • Falhas: ${resultado.falhas}\n`;
                    resposta += `   • Restantes: ${resultado.restantes}`;
                }
            }

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .ambos (ou .iniciar) =====
        if (comando === '.ambos' || comando === '.iniciar' || comando === '.start') {
            await message.reply('🚀 Iniciando campanha COMPLETA (Grupo + Canal)...\n⏳ Aguarde...');

            const resultado = await iniciarEnvioMassa('ambos');

            let resposta = `📊 *RELATÓRIO - CAMPANHA COMPLETA*\n\n`;

            if (resultado.sucesso) {
                resposta += `✅ *Status:* Concluída\n\n`;
                resposta += `📈 *Resultados:*\n`;
                resposta += `   • Enviados: ${resultado.enviados}\n`;
                resposta += `   • Falhas: ${resultado.falhas}\n`;
                resposta += `   • Inválidos: ${resultado.invalidos}\n`;
                resposta += `   • Total: ${resultado.total}`;
            } else {
                resposta += `⚠️ *Status:* ${resultado.motivo}\n\n`;
                if (resultado.enviados !== undefined) {
                    resposta += `📈 *Parcial:*\n`;
                    resposta += `   • Enviados: ${resultado.enviados}\n`;
                    resposta += `   • Falhas: ${resultado.falhas}\n`;
                    resposta += `   • Restantes: ${resultado.restantes}`;
                }
            }

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .status =====
        if (comando === '.status') {
            const enviadosGrupo = enviadosLog.filter(log => log.status === 'enviado' && log.tipoCampanha === 'grupo').length;
            const enviadosCanal = enviadosLog.filter(log => log.status === 'enviado' && log.tipoCampanha === 'canal').length;
            const enviadosAmbos = enviadosLog.filter(log => log.status === 'enviado' && log.tipoCampanha === 'ambos').length;
            const totalEnviados = enviadosGrupo + enviadosCanal + enviadosAmbos;
            const falhas = enviadosLog.filter(log => log.status === 'falha').length;
            const invalidos = enviadosLog.filter(log => log.status === 'invalido').length;
            const pendentesGrupo = [...numerosLista].filter(num => !jaEnviado(num, 'grupo')).length;
            const pendentesCanal = [...numerosLista].filter(num => !jaEnviado(num, 'canal')).length;
            const pendentesAmbos = [...numerosLista].filter(num => !jaEnviado(num, 'ambos')).length;

            let resposta = `📊 *STATUS DAS CAMPANHAS*\n\n`;
            resposta += `📱 *Total de números:* ${numerosLista.size}\n\n`;
            resposta += `📈 *Enviados por campanha:*\n`;
            resposta += `   👥 Grupo: ${enviadosGrupo}\n`;
            resposta += `   📢 Canal: ${enviadosCanal}\n`;
            resposta += `   🔥 Ambos: ${enviadosAmbos}\n`;
            resposta += `   ✅ Total: ${totalEnviados}\n\n`;
            resposta += `⏳ *Pendentes:*\n`;
            resposta += `   👥 Grupo: ${pendentesGrupo}\n`;
            resposta += `   📢 Canal: ${pendentesCanal}\n`;
            resposta += `   🔥 Ambos: ${pendentesAmbos}\n\n`;
            resposta += `❌ *Falhas:* ${falhas}\n`;
            resposta += `⚠️ *Inválidos:* ${invalidos}\n\n`;
            resposta += `⏰ *Horário permitido:* ${configMarketing.horarioInicio} - ${configMarketing.horarioFim}\n`;
            resposta += `🕐 *No horário?* ${dentroDoHorario() ? '✅ Sim' : '❌ Não'}`;

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .config =====
        if (comando === '.config') {
            if (args.length === 0) {
                let resposta = `⚙️ *CONFIGURAÇÕES*\n\n`;
                resposta += `⏱️ *Delay entre envios:* ${configMarketing.delayEntreEnvios / 1000}s\n`;
                resposta += `📦 *Tamanho do lote:* ${configMarketing.tamanhoLote} msgs\n`;
                resposta += `⏸️ *Delay entre lotes:* ${configMarketing.delayEntreLotes / 1000}s\n`;
                resposta += `🕐 *Horário início:* ${configMarketing.horarioInicio}\n`;
                resposta += `🕐 *Horário fim:* ${configMarketing.horarioFim}\n`;
                resposta += `⏰ *Respeitar horário:* ${configMarketing.enviarApenasDuranteHorario ? '✅' : '❌'}\n\n`;
                resposta += `*Como alterar:*\n`;
                resposta += `.config delay <segundos>\n`;
                resposta += `.config lote <quantidade>\n`;
                resposta += `.config lote-delay <segundos>\n`;
                resposta += `.config inicio <HH:MM>\n`;
                resposta += `.config fim <HH:MM>\n`;
                resposta += `.config horario on/off`;

                await message.reply(resposta);
                return;
            }

            const opcao = args[0].toLowerCase();
            const valor = args[1];

            if (opcao === 'delay' && valor) {
                const segundos = parseInt(valor);
                if (segundos >= 10 && segundos <= 300) {
                    configMarketing.delayEntreEnvios = segundos * 1000;
                    await salvarConfigMarketing();
                    await message.reply(`✅ Delay entre envios: ${segundos}s`);
                } else {
                    await message.reply('❌ Delay deve ser entre 10 e 300 segundos');
                }
            } else if (opcao === 'lote' && valor) {
                const qtd = parseInt(valor);
                if (qtd >= 1 && qtd <= 100) {
                    configMarketing.tamanhoLote = qtd;
                    await salvarConfigMarketing();
                    await message.reply(`✅ Tamanho do lote: ${qtd} mensagens`);
                } else {
                    await message.reply('❌ Tamanho do lote deve ser entre 1 e 100');
                }
            } else if (opcao === 'lote-delay' && valor) {
                const segundos = parseInt(valor);
                if (segundos >= 60 && segundos <= 3600) {
                    configMarketing.delayEntreLotes = segundos * 1000;
                    await salvarConfigMarketing();
                    await message.reply(`✅ Delay entre lotes: ${segundos}s`);
                } else {
                    await message.reply('❌ Delay entre lotes deve ser entre 60 e 3600 segundos');
                }
            } else if (opcao === 'inicio' && valor) {
                if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(valor)) {
                    configMarketing.horarioInicio = valor;
                    await salvarConfigMarketing();
                    await message.reply(`✅ Horário de início: ${valor}`);
                } else {
                    await message.reply('❌ Formato inválido. Use HH:MM (ex: 08:00)');
                }
            } else if (opcao === 'fim' && valor) {
                if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(valor)) {
                    configMarketing.horarioFim = valor;
                    await salvarConfigMarketing();
                    await message.reply(`✅ Horário de fim: ${valor}`);
                } else {
                    await message.reply('❌ Formato inválido. Use HH:MM (ex: 22:00)');
                }
            } else if (opcao === 'horario' && valor) {
                if (valor.toLowerCase() === 'on') {
                    configMarketing.enviarApenasDuranteHorario = true;
                    await salvarConfigMarketing();
                    await message.reply('✅ Restrição de horário ATIVADA');
                } else if (valor.toLowerCase() === 'off') {
                    configMarketing.enviarApenasDuranteHorario = false;
                    await salvarConfigMarketing();
                    await message.reply('✅ Restrição de horário DESATIVADA');
                } else {
                    await message.reply('❌ Use: on ou off');
                }
            } else {
                await message.reply('❌ Opção ou valor inválido');
            }

            return;
        }

        // ===== COMANDO: .mensagem =====
        if (comando === '.mensagem' || comando === '.msg') {
            let resposta = `💬 *MENSAGENS ATUAIS:*\n\n`;
            resposta += `*📨 Mensagem 1 (Grupo):*\n${configMarketing.mensagem1}\n${configMarketing.linkGrupo}\n\n`;
            resposta += `*📢 Mensagem 2 (Canal):*\n${configMarketing.mensagem2}\n${configMarketing.linkCanal}\n\n`;
            resposta += `⏱️ *Delay entre mensagens:* ${configMarketing.delayEntreMensagens / 1000}s\n\n`;
            resposta += `*Para alterar, edite o arquivo:*\nmarketing-config.json`;

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .links =====
        if (comando === '.links') {
            if (args.length === 0) {
                let resposta = `🔗 *LINKS CONFIGURADOS:*\n\n`;
                resposta += `👥 *Grupo:* ${configMarketing.linkGrupo}\n\n`;
                resposta += `📢 *Canal:* ${configMarketing.linkCanal}\n\n`;
                resposta += `*Para alterar:*\n`;
                resposta += `.links grupo https://...\n`;
                resposta += `.links canal https://...`;

                await message.reply(resposta);
                return;
            }

            const tipo = args[0].toLowerCase();
            const link = args[1];

            if (!link) {
                await message.reply('❌ Uso: .links <grupo/canal> <link>');
                return;
            }

            if (tipo === 'grupo') {
                configMarketing.linkGrupo = link;
                await salvarConfigMarketing();
                await message.reply(`✅ Link do grupo atualizado!\n\n${link}`);
            } else if (tipo === 'canal') {
                configMarketing.linkCanal = link;
                await salvarConfigMarketing();
                await message.reply(`✅ Link do canal atualizado!\n\n${link}`);
            } else {
                await message.reply('❌ Tipo inválido. Use: grupo ou canal');
            }

            return;
        }

        // ===== COMANDO: .testar =====
        if (comando === '.testar' || comando === '.test') {
            if (args.length === 0) {
                await message.reply('❌ Uso: .testar <número> [tipo]\n\nExemplos:\n.testar 258841234567 grupo\n.testar 258841234567 canal\n.testar 258841234567 ambos\n\nSem tipo = ambos');
                return;
            }

            const numero = args[0].replace(/\D/g, '');
            const tipo = args[1]?.toLowerCase() || 'ambos';

            if (!['grupo', 'canal', 'ambos'].includes(tipo)) {
                await message.reply('❌ Tipo inválido! Use: grupo, canal ou ambos');
                return;
            }

            const nomeTeste = tipo === 'grupo' ? 'link do GRUPO' :
                             tipo === 'canal' ? 'link do CANAL' :
                             'AMBOS (grupo + canal)';

            await message.reply(`📤 Enviando teste ${nomeTeste} para ${numero}...\n⏳ Aguarde...`);

            const resultado = await enviarMensagens(numero, tipo);

            if (resultado.sucesso) {
                let msg = `✅ Teste enviado com sucesso para ${numero}!\n\n`;
                if (tipo === 'grupo') {
                    msg += `✉️ 1 mensagem: Link do grupo`;
                } else if (tipo === 'canal') {
                    msg += `✉️ 1 mensagem: Link do canal`;
                } else {
                    msg += `✉️ Mensagem 1: Link do grupo\n✉️ Mensagem 2: Link do canal`;
                }
                await message.reply(msg);
            } else {
                await message.reply(`❌ Falha ao enviar para ${numero}\nMotivo: ${resultado.motivo}`);
            }

            return;
        }

        // ===== COMANDO: .relatorio =====
        if (comando === '.relatorio' || comando === '.report') {
            const limite = 15;
            const enviosRecentes = enviadosLog.slice(0, limite);

            let resposta = `📊 *RELATÓRIO DE ENVIOS*\n\n`;
            resposta += `Total de registros: ${enviadosLog.length}\n\n`;

            if (enviosRecentes.length === 0) {
                resposta += `Nenhum envio registrado ainda.`;
            } else {
                resposta += `*Últimos ${Math.min(limite, enviadosLog.length)} envios:*\n\n`;

                enviosRecentes.forEach((log, index) => {
                    const emoji = log.status === 'enviado' ? '✅' :
                                  log.status === 'falha' ? '❌' :
                                  log.status === 'invalido' ? '⚠️' : '❓';

                    const tipo = log.tipoCampanha === 'grupo' ? '👥' :
                                log.tipoCampanha === 'canal' ? '📢' :
                                log.tipoCampanha === 'ambos' ? '🔥' : '❓';

                    resposta += `${index + 1}. ${emoji} ${tipo} ${log.numero}\n`;
                    resposta += `   ${log.data}\n`;
                    if (log.detalhes) {
                        resposta += `   ${log.detalhes}\n`;
                    }
                    resposta += `\n`;
                });

                if (enviadosLog.length > limite) {
                    resposta += `... e mais ${enviadosLog.length - limite} registros\n\n`;
                }

                resposta += `💾 Log completo em: enviados-log.json`;
            }

            await message.reply(resposta);
            return;
        }

        // ===== COMANDO: .limpar =====
        if (comando === '.limpar' || comando === '.clear') {
            const total = enviadosLog.length;
            enviadosLog = [];
            await salvarEnviados();

            await message.reply(`🗑️ Histórico limpo!\n\n${total} registros foram removidos.\n\n⚠️ Agora todos os números podem receber a mensagem novamente.`);
            return;
        }

        // ===== COMANDO: .ajuda =====
        if (comando === '.ajuda' || comando === '.help') {
            let resposta = `📢 *BOT DE MARKETING - MÚLTIPLAS CAMPANHAS*\n\n`;
            resposta += `*🎯 Tipos de Campanha:*\n\n`;
            resposta += `👥 .grupo\n`;
            resposta += `   Enviar APENAS link do grupo\n\n`;
            resposta += `📢 .canal\n`;
            resposta += `   Enviar APENAS link do canal\n\n`;
            resposta += `🔥 .ambos (ou .iniciar)\n`;
            resposta += `   Enviar AMBOS (grupo + canal)\n\n`;
            resposta += `*📋 Outros Comandos:*\n\n`;
            resposta += `📊 .status\n`;
            resposta += `   Ver status de cada campanha\n\n`;
            resposta += `⚙️ .config [opcao] [valor]\n`;
            resposta += `   Ver ou alterar configurações\n\n`;
            resposta += `💬 .mensagem\n`;
            resposta += `   Ver mensagens configuradas\n\n`;
            resposta += `🔗 .links [grupo/canal] [link]\n`;
            resposta += `   Ver ou alterar links\n\n`;
            resposta += `📤 .testar <número>\n`;
            resposta += `   Enviar teste para um número\n\n`;
            resposta += `📊 .relatorio\n`;
            resposta += `   Ver relatório de envios\n\n`;
            resposta += `🗑️ .limpar\n`;
            resposta += `   Limpar histórico de envios\n\n`;
            resposta += `❓ .ajuda\n`;
            resposta += `   Mostrar esta ajuda\n\n`;
            resposta += `*✨ Vantagens:*\n`;
            resposta += `• Campanhas independentes\n`;
            resposta += `• Envie grupo, canal ou ambos\n`;
            resposta += `• Controle anti-ban integrado\n`;
            resposta += `• Cada número recebe apenas 1x por campanha`;

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
    console.log('\n🛑 Encerrando bot de marketing...');
    await client.destroy();
    process.exit(0);
});
