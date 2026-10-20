# Digla RPG

**Protótipo multiplayer 2D — versão 1.0.** Vários jogadores compartilham o mesmo mundo em um servidor Node.js, sem banco de dados. As contas e os salvamentos são privados e não acompanham o repositório. Ainda não há hospedagem pública do jogo.

Sem serviços externos ou dependências de execução. Requer Node.js 22 ou superior.

Para entender e editar o projeto, veja o **[Guia do código](docs/GUIA-DO-CODIGO.md)**: estrutura das pastas, responsabilidade de cada arquivo e exemplos de alterações de velocidade, casas, chão, cores e sprites.

## Jogar

### Multiplayer: iniciar e conectar

Na pasta do projeto, execute `npm.cmd start` ou `npm.cmd run dev`. No computador que executa o servidor, abra **http://localhost:3000**. Outros computadores na mesma rede usam **`http://IP-DO-SERVIDOR:3000`**; consulte o IPv4 com `ipconfig` no servidor. O processo deve continuar aberto. O servidor escuta em `0.0.0.0` por padrão; para restringir ao próprio computador, defina `$env:HOST='127.0.0.1'` antes de iniciar. Nenhuma regra de firewall ou roteador é alterada pelo projeto.

Cada pessoa cria uma conta própria. Para testar duas pessoas no mesmo computador, use navegadores diferentes ou uma janela anônima. Entrar novamente na mesma conta encerra a sessão anterior. São permitidos até **32 jogadores conectados**; esse é um limite configurado, não uma medição de capacidade.

- **Mundo compartilhado:** posições, monstros, vida dos monstros, corpos, loot, itens no chão e cargas de mineração. Inventário, banco, equipamento, missões, mana e skills continuam pessoais. Não há PvP.
- **Online:** botão na lateral com lista de jogadores, chat e convites para grupos de até cinco pessoas. Membros vivos no mesmo piso a até oito quadrados dividem o XP do dano sem multiplicá-lo. Participação em abates também conta para missões.
- **Trocas:** fique ao lado, selecione a pessoa em Online e clique em Trocar. Os dois aceitam, oferecem itens/quantidades e confirmam a mesma revisão. Alterar uma oferta apaga as confirmações; afastamento, saída ou expiração cancelam sem transferir itens. Mochilas são validadas antes da transferência conjunta.
- **Loot:** reservado por 60 segundos para quem causou mais dano e seu grupo próximo no momento da morte; depois libera para todos. O prazo do corpo continua sendo dois minutos.
- **Servidor:** simula o mundo a cada 100 ms, mesmo sem pedidos de combate do cliente. O navegador consulta atualizações a cada 250 ms e interpola movimentos. O servidor verifica deslocamentos, alcance, recargas, inventários e ações concorrentes.
- **Pausar:** interrompe os controles daquele jogador; o mundo compartilhado continua ativo. Uma sessão sem comunicação por dez segundos sai da lista online.

Publicar este código no GitHub **não hospeda uma partida na Internet**. Esta versão permite jogar no servidor local e pela rede local. Hospedagem externa e HTTPS são uma etapa separada.

### Aventura e progressão — versão 0.9

Abra **Diário e profissões** na lateral. As abas reúnem missões, mineração/ferraria e a opção de modo de jogo.

- **O mundo começa no modo normal.** Orc básico tem 30 HP e o comandante 400. Preços normais são próprios de cada item, com venda a aproximadamente 30% do preço de compra.
- **Modo de teste global:** o dono do servidor pode definir `$env:DIGLA_TEST_MODE='1'` antes de iniciar para preços em 1 ouro e vida dos orcs 10×. Jogadores não podem alterar essa configuração pelo navegador. Para voltar ao normal, remova a variável e reinicie; o progresso é preservado.
- **Equipamentos afetam o combate:** espada = 3–6 + ATK + 1 a cada dois níveis acima do primeiro em Combate. Mãos vazias continuam 3–6. ARM reduz dano físico pela fórmula `ARM / (ARM + 20)`; cinco peças ARM 1 reduzem 20%. Magias não são reduzidas pela armadura física. O Cajado de Raio mantém sua fórmula e os multiplicadores anteriores.
- **Novos itens:** espada de ferro ATK 4, requer Combate 3; armadura reforçada ARM 2; lâmina do comandante ATK 6, requer Combate 5, exclusiva de chefe/missão; minério e barra de ferro. Requisitos aparecem no Olhar e são verificados ao equipar.
- **Cinco missões:** converse com Rafhi, Pang e Matlo e escolha **Conversar sobre missões**. A sequência pede 5 salmões assados, depois 3, depois 5 orcs, 3 guerreiros e o comandante. Entregas e recompensas são únicas, persistidas e não consomem itens se faltar espaço para receber o prêmio.
- **Comandante Presa de Pedra:** sala norte da caverna dos orcs, **(86,16), piso -1**. Entrada da caverna na superfície em **(94,26)**. Tem pancada frontal, golpe 3×3 e investida, sempre avisados no chão. Abaixo de 50% de HP usa especiais mais frequentemente. Ao sair da sala, o encontro reinicia. Reaparece em 60 segundos, deixa 40–80 moedas e tem 25% de chance de lâmina; a missão final garante uma lâmina independentemente do sorteio.
- **Orc arqueiro:** recua quando o jogador chega perto e atira respeitando paredes. **Xamã:** marca uma área antes da magia. **Defensor:** anda mais lentamente e reduz dano físico em 35%; magia funciona melhor contra ele. Dragão e monstros de água mantêm seu limite de 1 de dano a cada 5 segundos.
- **E com mira:** pressione E, escolha uma área 3×3 a até três quadrados e confirme com o esquerdo; Esc cancela. Confirmar não inicia caminhada. Mana e recarga só são gastas em um lançamento aceito pelo servidor.
- **Mineração:** botão direito nos veios indicados por picaretas no minimapa; um veio fica em **(85,14), piso +1**, na montanha dos orcs. Cada extração dá um minério e 10 XP, começa em 2,5s e melhora com o nível. Cada veio tem cinco cargas e recupera 60s após esgotar. Movimento, dano ou desconexão interrompem.
- **Ferraria:** botão direito na forja ao lado de Matlo, **(35,22), piso 0**. Duas unidades de minério viram uma barra; três barras fazem uma espada, duas um elmo e cinco uma armadura reforçada. A armadura exige Ferraria 2. A fabricação não falha aleatoriamente e só consome os materiais se puder entregar o resultado.

Os valores de testes descritos abaixo dependem do modo global do servidor.

### Atalhos rápidos e retorno ao templo

- **1, 2 e 3:** usam a poção configurada no botão correspondente. **Botão direito no atalho** permite escolher vida ou mana; a configuração é salva por personagem. A poção precisa estar na mochila e não é consumida se o atributo já estiver cheio.
- **H — Corrida:** custa **10 de mana**, aumenta a velocidade para **1,5× durante 5 segundos** e tem **10 segundos de recarga**, contados desde a ativação.
- **B — Retorno ao templo:** prepara um portal por **10 segundos**. Caminhar ou receber qualquer dano cancela; pausar, sair ou perder a conexão também interrompe o preparo. Ao completar, leva ao spawn do templo e começa uma recarga de **10 minutos**. Cancelar não gasta a recarga.

Esses atalhos estão disponíveis para todos os personagens. Q/W/E/R ficam em ícones de **36 px** na parte inferior, junto aos atalhos gerais. Os painéis de **pesca e culinária ficam centralizados** para não sobrepor as habilidades.

### Cenário e novos controles

Os biomas têm decorações próprias em pixel art: basalto, brasas, runas e troncos queimados no fogo; corais, conchas, juncos e cristais na água; estandartes, ossadas, caixas e ruínas nos orcs. Cavernas e montanhas também recebem detalhes. As áreas vazias dos andares usam fundos texturizados, sem liberar passagem fora do mapa.

As árvores seguem uma espécie por região: **carvalhos verdes na vila**, **pinheiros nos orcs**, **árvores queimadas no fogo** e **palmeiras na costa**, sem mistura aleatória de copas. A loja do **Rafhi** tem peixes expostos na parede e uma placa com peixe na entrada; a do **Matlo** tem armaduras na parede e uma placa com armadura.

- **Esquerdo:** caminha até o ponto clicado, inclusive no minimapa.
- **Direito no mundo:** ataca ou usa objetos próximos, sem iniciar caminhada. Aproxime-se manualmente da fonte, fogão, água, NPC, banco ou cadáver. No chão livre, não caminha.
- **Shift + esquerdo:** olha chão, objetos, decorações, criaturas e itens; aparece uma descrição verde, como **“You see grass.”**, sem usar ou mover nada.
- **Direito em um item:** abre um menu com **Olhar** e a ação disponível (**Usar**, **Recolher**, **Guardar**, **Retirar** ou **Configurar / usar**). A mochila continua abrindo diretamente pelo direito. Arrastar itens mantém a aproximação da origem, como antes.

Abra um terminal nesta pasta e execute:

```powershell
npm start
```

Acesse **http://localhost:3000**. Também é possível abrir `Iniciar Digla.cmd` com dois cliques. Mantenha o terminal aberto enquanto joga; use Ctrl+C para encerrar o servidor.

Depois de atualizar o código, encerre o servidor existente com **Ctrl+C**, execute **`npm.cmd run dev`** e atualize o navegador com **Ctrl+F5**. O jogo avisa se a página e o servidor estiverem em versões diferentes; isso evita continuar usando regras antigas de monstros.

1. Clique em **Criar conta**, escolha um nome (3–20 caracteres) e uma senha (6–128 caracteres).
2. Selecione Citizen, Mage ou Warrior, personalize cabeça, corpo, pernas e botas e confira os quatro lados na prévia. Os dois addons de cada outfit já estão incluídos.
3. Clique em **Começar minha jornada**. Use as **setinhas** ou o **clique esquerdo no mapa** para caminhar.
4. **Sair do mundo** salva a posição e volta ao login. Entre novamente com o mesmo nome e senha, inclusive depois de reiniciar o servidor.

O mapa tem **192 × 168 tiles**, com câmera acompanhando o personagem, uma vila, lago e três territórios afastados: **Domínio dos Orcs a nordeste**, **Terras de Brasas ao sul** e **Costa das Marés a leste**. Estradas e uma ponte conectam as regiões; água, lava, montanhas e muralhas bloqueiam a passagem onde não há entrada. O clique esquerdo encontra um caminho até o destino sem atravessar obstáculos. Setinhas assumem o controle manual; Esc cancela a caminhada automática.

A vila possui uma **área protegida de 30 × 30 quadrados** ao redor do spawn. Nenhum monstro nasce ou entra nela e não há combate dentro desses limites. O contorno azul no minimapa marca a zona segura. Orc e elementais que antes ficavam perto do templo foram movidos para seus territórios, inclusive em contas antigas.

Use **+ / −** ou a **roda do mouse** para dar zoom no mundo e no minimapa. O mundo permite 50%, 100%, 150% e 200%; o minimapa, 1×, 2×, 4× e 8×. Clique no indicador para restaurar o zoom inicial. **Clique no minimapa para caminhar** até o ponto escolhido no andar atual; obstáculos continuam bloqueando a passagem.

## Fortaleza, montanhas e cavernas

No modo de teste, a vida de todos os orcs é multiplicada por **10**: orc 300, sentinelas/muralha/caverna 400, guerreiro 500 e capitão 800. O dano deles continua igual.

A barra Q/W/E/R usa ícones; passe o mouse para consultar nome, mana e recarga. Os efeitos incluem raios com ramificações, faíscas, tempestade e anéis de choque.

O **Castelo Presa de Pedra** fica em **(80, 20)**, com entrada sul em **(86, 29)**. Tem quatro torres, pátio, sentinelas, guerreiro, capitão e escada para caminhar sobre as muralhas. Todos os orcs podem deixar moedas e sortear espada/cajado com a configuração de drop existente.

O mundo tem **três pisos**: superfície **0**, montanhas/muralhas **+1** e cavernas **-1**. **Pise na escada ou no buraco** usando setinhas ou clicando para caminhar. A troca é automática, sem tecla adicional. No outro piso há uma escada/ladder para voltar; a chegada fica ao lado dela para evitar uma troca de volta imediata. O nome do local e o número do piso aparecem abaixo do minimapa.

| Destino             | Entrada na superfície         |
| ------------------- | ----------------------------- |
| Montanha dos Orcs   | (86, 18)                      |
| Caverna dos Orcs    | (94, 26)                      |
| Muralhas do castelo | (91, 22), dentro da fortaleza |
| Pico das Brasas     | (43, 109)                     |
| Caverna de magma    | (61, 124)                     |
| Falésias das Marés  | (170, 68)                     |
| Gruta das Marés     | (154, 94)                     |

Cada piso tem terreno, colisões e minimapa próprios. Monstros, itens no chão e cadáveres pertencem ao seu piso; ataques e coleta não atravessam andares. Há orcs, um elemental de magma e um espírito nas cavernas. A gruta também possui água para pescar. A posição com o andar é salva na conta e restaurada ao entrar novamente.

## Lojas, equipamentos e banco

Aproxime-se do vendedor ou banco e clique com o **botão direito** para abrir o painel:

- **Rafhi — Alimentos (25, 19):** dentro da casa ao norte, compra e vende salmão cru, assado e queimado. A loja começa somente com salmões, sem poções.
- **Pang — Poções (17, 21):** casa a oeste da loja do Rafhi, em (15, 19), com entrada sul em (18, 23). Vende poção de vida e poção de mana por **1 moeda dourada cada**, e compra de volta pelo mesmo preço.
- **Matlo — Equipamentos (36, 22):** dentro da casa a nordeste, vende espada, cajado, elmo, armadura, calça e botas de couro/ferro, escudos de madeira/ferro, colares e anéis de bronze/prata e flechas.
- **Banco de Brumavale, ao sul do templo:** salão em **(31, 34)**, com quatro bancos em **(33, 36), (41, 36), (33, 39) e (41, 39)**. Todos abrem o mesmo depósito pessoal de **48 espaços**, separado da mochila e salvo por conta. Clique esquerdo no banco para se aproximar e abrir; botão direito abre somente se estiver próximo. Com o painel aberto, **clique esquerdo em um item da mochila para guardar a pilha inteira**, ou **em um item do depósito para retirar a pilha inteira**. Isso também funciona na mochila lateral.

O salão tem portas ao norte e ao sul, com caminho de pedra até a entrada norte **(37, 34)**. A estrada principal em X: 29 fica livre ao lado do edifício. O centro tem piso comum, sem área ou placa de doação. É possível largar itens em tiles caminháveis, seguindo a limpeza de 15 minutos. Itens no chão são compartilhados; os depósitos são pessoais.

**Dário — Dados (38, 36)** fica dentro do banco, em seu próprio canto com tapete. Converse com o botão direito estando próximo, informe uma aposta em moedas douradas da mochila e escolha **baixo (1–3)** ou **alto (4–6)**. O servidor sorteia um dado de seis lados. Acertar paga **2× o valor apostado, incluindo a aposta**; errar perde a aposta. Exemplo: com 10 moedas, apostar 3 deixa **13 ao ganhar** ou **7 ao perder**. Ouro no banco e moedas cinzas não pagam apostas. Reabrir a conversa mostra o último resultado.

Com o banco aberto, clique esquerdo para **Guardar** ou **Retirar** a pilha inteira. O menu do botão direito continua oferecendo essas ações e **Olhar**. **Guardar toda a mochila** deposita tudo sem alterar equipamentos vestidos; se faltar espaço, nenhum item é movido.

As casas têm interiores visíveis. Rafhi e Matlo têm entradas ao sul; a cozinha a oeste tem entrada ao norte, em **(20, 29)**, ligada à rua por um caminho de pedra.

Todos os itens das lojas custam e são vendidos por **1 moeda dourada por unidade**, para testes. Cada vendedor negocia seu próprio catálogo. O pagamento usa somente o ouro na mochila; moedas cinzas não são convertidas automaticamente. Se faltar saldo ou espaço, a operação é recusada sem perder itens.

Os equipamentos podem ser arrastados ao espaço correspondente, ou equipados/guardados pelo menu do botão direito. **Olhar** mostra **ATK: 1 no cajado**, **ATK: 2 na espada** e **ARM: 1 em elmos, armaduras, calças, botas e escudos**. Os valores ficam no catálogo em `public/js/items.js`; nesta etapa são atributos exibidos, sem uma nova fórmula de dano ou redução de dano. Flechas podem ser equipadas e empilhadas, sem ataque de arco.

O minimapa mostra ícones de **pesca, templo, fogão, alimentos, equipamentos e banco**, com legenda abaixo. A pesca continua disponível em qualquer margem válida.

## Limpeza do chão

O mundo de cada conta tem um **ciclo persistente de 15 minutos** para os itens soltos no chão. Mover uma pilha não adia a limpeza. Mochila, equipamentos e banco são preservados. **Cadáveres têm prazo próprio: desaparecem 2 minutos após a morte, junto com o loot que ainda estiver dentro.** Podem ser arrastados entre quadrados transitáveis, exigindo aproximação à origem como os itens; mover não reinicia o prazo. O servidor limpa também contas desconectadas e aplica prazos vencidos quando é iniciado novamente.

Para alterar o intervalo, edite `GROUND_CLEANUP_INTERVAL_MS` em `public/js/game/world-rules.js`. A data da próxima limpeza já salva continua valendo até vencer; o novo intervalo é usado nos próximos ciclos.

O **botão direito** ataca ou interage sem aproximar o jogador. Itens abrem seu menu de ações, incluindo **Olhar**. O menu nativo do navegador fica desativado durante o jogo.

## Templo inicial

O templo tem **7 × 7 quadrados**, com o centro exato no spawn **(29, 27)**. É um pátio aberto **sem paredes**, com apenas quatro colunas nos cantos, mosaico de pedra e fonte alinhada ao centro em **(29, 25)**. Clique com o **botão direito na fonte** para recuperar **toda a vida e mana**, respeitando os máximos. A interação exige até um quadrado de distância; o servidor valida a restauração. O templo aparece em claro no minimapa e a fonte em turquesa.

A lateral tem minimapa, vida vermelha, mana azul e espaços para espada, armadura, escudo, calça, botas, elmo, anel, mochila, colar e flechas. Clique com o **botão direito na mochila** para abrir/fechar seus **12 espaços**; o botão × também fecha o inventário. Pelo teclado, foque a mochila e use Enter ou Espaço. Os desenhos apagados são guias dos slots, sem itens equipados. Vida e mana começam em 100/100. A vida muda com combate e comida e fica salva; mana é consumida pelas habilidades e pela corrida.

## Skills e pesca

**Vitalidade** começa no nível 1. Todo dano efetivamente causado pelo jogador concede **1/3 desse dano em XP**, incluindo mãos vazias, espada e os três elementos do cajado. Dano além da vida restante do alvo não conta. O nível 2 exige **100 XP** e os custos seguintes dobram: 200, 400, 800… Cada nível acrescenta **30 de vida máxima e 15 de mana máxima**. Assim, os máximos passam de **100/100** para **130/115** no nível 2 e **160/130** no nível 3. Subir de nível aumenta os limites, preservando os valores atuais; a fonte, comida e poções podem recuperar o restante. XP e máximos permanecem ao atualizar ou entrar novamente.

As **poções de vida** recuperam até **35 de vida instantaneamente**; as **poções de mana**, até **50 de mana instantaneamente**. Use o menu do botão direito → **Usar**. Uma poção não é consumida se o recurso correspondente estiver cheio. Os itens são empilháveis, podem ser guardados no banco ou largados no chão e mostram o efeito no **Olhar**.

O **salmão assado** inicia uma regeneração de **20 de vida e 15 de mana a cada 3 segundos durante 1 minuto**. A primeira recuperação acontece após 3 segundos. Cada novo salmão acrescenta um minuto ao efeito, mantendo os mesmos valores por intervalo. Os limites do personagem nunca são ultrapassados. Se vida e mana estiverem ambas cheias, o peixe não é consumido; com apenas uma delas baixa, ele pode ser comido. A duração e o próximo intervalo são salvos: ao retornar, o servidor aplica os intervalos vencidos, limitados ao tempo de comida restante.

Clique em **Skills e níveis** para ver **Pesca**, **Magia**, **Culinária** e **Combate**, começando no nível 1. **F** é a tecla de ação: ataca um orc no alcance da arma, interage com o fogão quando você está próximo, ou com a água para pescar, nessa ordem de prioridade.

1. Caminhe até ficar a **1 quadrado da água** (inclusive diagonal).
2. Aperte **F** ou clique com o **botão direito na água** para começar a pescar automaticamente, com uma tentativa a cada **0,6 segundo**.
3. Aperte **F novamente**, ou use novamente o **botão direito na água**, quando o marcador estiver no **centro verde** da barra. O acerto dobra a chance de salmão até a próxima captura. Fora do verde, a chance continua normal. Há um acerto/erro por desafio.
4. Ao capturar, um novo desafio aparece automaticamente. **Esc**, caminhar ou sair da janela interrompem a pesca.

O peixe inicial é o **salmão cru**, disponível desde o nível 1. Todos os salmões crus empilham em **um único slot** da mochila, com contador de quantidade. A chance atual é de **10% no nível 1**, +1 ponto percentual por nível, até 45%; com o bônus verde, 20% no nível 1 e até 90%. Sem espaço livre ou pilha de salmão existente, a pesca para.

Cada salmão dá **10 XP de Pesca**. Os custos para subir de nível são **100, 200, 400, 800… XP**, sem descartar sobras. Assim, o nível 2 exige 100 XP totais (10 salmões), e o nível 3 exige 300 XP totais (30 salmões). Peixes e XP são salvos no servidor; fechar o jogo não continua pescando.

## Fogão e Culinária

O fogão fica **dentro da casa da cozinha**, a oeste do templo, em **(21, 30)**, marcado com fogo no minimapa. Entre pela porta ao norte da casa. Clique com o **botão direito no fogão** quando estiver ao lado para abrir o menu, ou aproxime-se e aperte **F**. A interação aceita um quadrado de distância, inclusive diagonal; o próprio fogão bloqueia a passagem.

No menu, escolha **Cozinhar 1** ou **Cozinhar todos**. Cada tentativa leva **1,2 segundo** e consome somente **um salmão cru**. O RNG começa em **25% no nível 1** de Culinária e aumenta **5 pontos percentuais por nível**, até **100% no nível 16**.

- Sucesso: **salmão assado**, dourado com marcas de grelha, e **10 XP de Culinária**.
- Falha: **salmão queimado**, preto, sem XP.

Cru, assado e queimado são pilhas distintas na mochila, uma por tipo. O servidor confere o espaço antes de consumir o ingrediente. **Parar** interrompe o preparo mantendo o menu aberto; **Esc**, ×, caminhar ou perder foco fecham o menu e interrompem o preparo. Os crus restantes ficam guardados. A progressão usa os mesmos custos de skill: 100, 200, 400… XP. Resultados e XP são salvos na conta, sem preparo offline.

## Comer, largar itens e combater

- **Botão direito no salmão assado da mochila → Usar:** consome uma unidade e inicia **1 minuto de regeneração**, com **20 de vida e 15 de mana a cada 3 segundos**. **Salmão cru e queimado não podem ser comidos.**
- **Arrastar da mochila para o mapa:** larga a pilha arrastada em um quadrado caminhável. Água, casas, obstáculos e o quadrado ocupado pelo orc vivo recusam a transferência. Os itens ficam visíveis no chão e não bloqueiam a caminhada.
- **Arrastar um item que já está no chão:** precisa estar a até um quadrado da origem. Se estiver longe, o personagem começa a se aproximar no início do arrasto e conclui a transferência quando chega. É possível mover para outro quadrado caminhável ou para a mochila; peixes iguais empilham, armas ocupam espaços separados.
- **Botão direito no item no chão:** recolhe a pilha quando você está a até um quadrado, inclusive diagonal, desde que haja espaço na mochila. Itens no chão são salvos por conta neste protótipo.
- **Orc verde no castelo, em (86, 26):** tem **300 de vida**. Orc e mãos vazias causam **3–6 de dano**; espadas acrescentam ATK e bônus de Combate por golpe, com intervalo de **1 segundo**. Clique com o **botão direito** no orc para selecionar o alvo; caminhe manualmente até o alcance da arma; repetir o clique interrompe seus ataques. **F** seleciona o inimigo mais próximo no mesmo andar, inclusive fora do alcance; repetir F mantém a seleção. O ataque continua selecionado enquanto você anda, mas os golpes só saem dentro do alcance. O orc persegue respeitando obstáculos e a zona protegida. Trocar de andar, morrer ou sair/pausar interrompe o encontro, sem golpes offline.
- **Números de dano:** sobem sobre quem recebeu o golpe, usando a cor do elemento quando há magia. O dano máximo da faixa atual ganha contorno e brilho amarelos; o destaque não adiciona dano.
- **Corpo do orc:** fica deitado no local da morte. Clique com o **botão direito** ao lado do corpo para abrir o loot de **6 espaços**. Sempre contém **5–15 moedas douradas**, além da arma quando sorteada. A chance de arma vem de `ORC_DROP_CHANCE` em `public/js/game/world-rules.js` (atualmente `1`, ou 100%, conforme sua configuração); o segundo sorteio continua 50% espada e 50% cajado. Os sorteios acontecem uma vez na morte. Arraste itens para a mochila ou armas para o equipamento; o menu do item no loot permite recolher ou olhar. × ou **Esc** fecha; afastar-se também fecha. O corpo permanece após o respawn por até **2 minutos desde a morte**. Mortes consecutivas podem deixar vários corpos simultaneamente, cada um com seu próprio loot e prazo.

O orc reaparece **15 segundos** após ser derrotado. Se o jogador morrer, retorna ao spawn com vida cheia, sem perder itens ou XP.

## Inimigos e fraquezas

| Inimigo            | Local / piso   | Vida | Fraqueza |
| ------------------ | -------------- | ---- | -------- |
| Orc sentinela      | (84, 25) / 0   | 40   | Raio     |
| Orc guerreiro      | (89, 25) / 0   | 50   | Raio     |
| Capitão orc        | (86, 22) / 0   | 80   | Raio     |
| Orc da muralha     | (82, 21) / 1   | 40   | Raio     |
| Orc das cavernas   | (86, 24) / -1  | 40   | Raio     |
| Elemental de magma | (57, 120) / -1 | 65   | Água     |
| Espírito da gruta  | (149, 96) / -1 | 55   | Raio     |
| Orc                | (86, 26) / 0   | 30   | Raio     |
| Elemental de fogo  | (53, 126) / 0  | 50   | Água     |
| Elemental de água  | (148, 73) / 0  | 50   | Raio     |
| Guardião de brasas | (58, 112) / 0  | 70   | Água     |
| Espírito da lava   | (70, 122) / 0  | 45   | Água     |
| Draco de fogo      | (51, 127) / 0  | 90   | Água     |
| Guardião das marés | (151, 73) / 0  | 70   | Raio     |
| Espírito do recife | (162, 83) / 0  | 45   | Raio     |
| Serpente d’água    | (153, 95) / 0  | 90   | Raio     |

A magia correta causa **50% a mais de dano**, arredondado ao inteiro mais próximo: dano base 4 vira 6; base 7 vira 11. Os demais elementos usam o dano normal; espada e mãos vazias não recebem esse bônus. Nome, vida e fraqueza aparecem sobre cada criatura.

Botão direito seleciona o mob clicado; repetir no mesmo mob para de atacar, e clicar em outro troca o alvo. **F** escolhe um inimigo no alcance, priorizando o alvo já selecionado. Todos perseguem no próprio andar, respeitam a zona protegida e reaparecem após 15 segundos. **Draco de fogo e todos os monstros de água causam somente 1 de dano a cada 5 segundos**, sem golpes extras por clicar várias vezes. Orc básico e elemental de fogo causam 3–6; guardião de brasas e elemental de magma, 4–7; espírito da lava, 2–5; capitão orc, 5–8. Os valores ficam em `MOB_DEFINITIONS`. Cada criatura mantém seu próprio cadáver e loot de 6 espaços, com 5–15 moedas douradas; todos os tipos de orc sorteiam armas. Os marcadores verde, vermelho e azul no minimapa mostram os pontos iniciais dos mobs do andar atual.

## Espada, cajado e XP

### Cajado de raio e Q/W/E/R

O **Cajado de raio (ATK: 3)** é vendido pelo **Matlo por 1 moeda dourada**. Equipar no espaço de arma libera uma barra de habilidades. Seu ataque automático é de raio, alcança **3 quadrados** com linha de visão e usa **dano base = 3 + 5 × nível de Magia**, com intervalo de **3 segundos**. No nível 1, o dano base é 8; no nível 2, 13. O ataque automático não consome mana.

| Tecla | Habilidade                                                         | Dano base                                                    | Mana | Recarga     |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------ | ---- | ----------- |
| Q     | Raio em alvo único, alcance 3                                      | 2× o dano base do cajado                                     | 5    | 2 segundos  |
| W     | Veneno elétrico no alvo, alcance 3                                 | 0,5× por pulso, 5 pulsos a cada 1 segundo                    | 10   | 6 segundos  |
| E     | Tempestade em área 3×3 escolhida pelo mouse selecionado, alcance 3 | 1,5× em cada monstro atingido                                | 10   | 4 segundos  |
| R     | Onda de choque em área 5×5 centrada no personagem                  | 5× em cada monstro atingido, mais cura de 25% da vida máxima | 40   | 15 segundos |

Existe **intervalo mínimo de 0,5 segundo entre habilidades**, separado do ataque automático. Q/W/E exigem um alvo vivo, no mesmo andar, a até 3 quadrados e sem parede no caminho. R pode ser usado sem alvo. As áreas atingem apenas monstros, respeitam obstáculos e não causam dano ao próprio jogador. A cura nunca ultrapassa a vida máxima. O W começa após 1 segundo, mantém o dano calculado ao lançar e continua seus pulsos mesmo que o jogador saia do alcance; pausar, sair, mudar de andar ou morrer cancela os pulsos pendentes.

As fraquezas elementais existentes continuam aplicando +50% ao raio. Danos são arredondados para inteiros e limitados à vida restante do alvo; cada golpe/pulso concede metade do dano real em Magia e um terço em Vitalidade. Mana e recargas são validadas no servidor. Recarregar a página ou trocar de arma não remove as recargas.

**F seleciona o monstro vivo mais próximo no mesmo andar**, mesmo fora do alcance; apertar novamente mantém a seleção, sem desligar. O ataque começa quando o personagem entra no alcance com linha de visão. O personagem não anda automaticamente até o inimigo. **Botão direito no mesmo monstro continua alternando o ataque**, e Esc interrompe. Na vila protegida, F mantém as ações de pesca/fogão conforme a proximidade.

Arraste uma **espada ou cajado para o espaço de arma** (o desenho de espada no equipamento). Para guardar, arraste de volta à mochila. Botão direito na espada da mochila equipa; na espada equipada, guarda. Trocar uma arma da mochila pela equipada devolve a anterior ao espaço de origem.

**Espada e mãos vazias** alcançam 1 quadrado. O **cajado** alcança até **3 quadrados**, inclusive diagonais, sem atravessar obstáculos. Botão direito no cajado da mochila ou equipado abre o seletor: **Fogo** (vermelho intenso), **Água** (azul) ou **Raio** (amarelo). O menu também permite equipar/guardar. Cada estilo tem projétil e animação própria no orc, com a mesma cor no número do dano; dano máximo mantém o contorno amarelo. Não há gasto de mana nesta etapa.

O dano do cajado depende da skill **Magia**: **4–7 no nível 1**, **5–8 no nível 2**, **6–9 no nível 3**… Cada nível acrescenta 1 ao mínimo e ao máximo, para todos os elementos.

Cada dano realmente causado com **espada** concede **metade em XP de Combate**; com **cajado**, **metade em XP de Magia**. Exemplo: dano 3 dá 1,5 XP; dano 6 dá 3 XP. O golpe final considera apenas a vida retirada. Mãos vazias não dão esse XP. As duas skills usam os custos de 100, 200, 400… XP, preservando frações e sobras. Equipamento, elemento escolhido, loot e XP ficam salvos na conta.

## Moedas

Moedas douradas e cinzas são itens empilháveis. O orc sempre deixa **5–15 douradas**. Na mochila, clique com o **botão direito numa pilha de pelo menos 100 douradas** e escolha **Usar** para trocar **100 por 1 moeda cinza**, mantendo o restante. Cada clique faz uma troca; se já houver moedas cinzas, a nova se junta à pilha. Se faltar espaço, a troca é recusada sem consumir moedas. Uma pilha de exatamente 100 pode usar o próprio espaço liberado, inclusive com a mochila cheia. Não há troca inversa nesta etapa.

## Contas e dados

Contas e mundo são gravados juntos em **`data/game.json`**, por escrita temporária e substituição do arquivo. Não há SQLite, PostgreSQL, MongoDB ou outro banco de dados. `DIGLA_DATA_DIR` permite escolher outra pasta privada. Use apenas **um processo servidor por pasta de dados**.

Na primeira execução multiplayer, as contas de `data/accounts.json` são importadas com inventários, bancos e progresso; o arquivo original permanece como backup privado. É criado um mundo compartilhado inicial, substituindo os antigos mundos individuais. Não são somados os itens no chão nem os monstros de mundos antigos. Faça uma cópia de `data/` com o servidor parado antes de atualizar ou restaurar dados.

Senhas usam scrypt e salt individual; não são salvas em texto puro nem enviadas a outros jogadores. Cookies são HttpOnly e SameSite=Strict. Sessões, chat, convites e negociações ficam em memória: reiniciar exige novo login e cancela trocas pendentes. Arquivos de dados, `.env`, dependências e resultados de testes são ignorados pelo Git. O HTTP entrega apenas os arquivos públicos permitidos. Não há recuperação de senha nesta versão.

Sprites e cenários foram desenhados em código para este projeto. Os três visuais são interpretações próprias em pixel art inspiradas nos outfits clássicos de Tibia, sem arquivos de sprites extraídos do jogo. Cores e estilo podem ser refinados no próximo passo.

A vila usa calçamento de pedra e chão de pedregulhos. Os sprites têm contorno e sombreamento por camadas. O nome acima do personagem é texto HTML separado do canvas para manter a leitura nítida, inclusive em telas com escala diferente.

## Verificação

```powershell
npm test
```

Os testes usam diretórios temporários separados. Incluem regras do jogo, concorrência, reserva de loot, grupos, trocas, validação de movimento e migração. `tests/multiplayer-http.test.mjs` executa o servidor de produção e verifica dois jogadores, simulação sem polling do atacante, bloqueio de arquivos privados e persistência após reinício. `tests/server.test.mjs` mantém os contratos individuais antigos por um servidor exclusivo de compatibilidade em `tests/helpers/legacy-server.mjs`; ele não é usado ao iniciar o jogo. Para mudar a porta, defina `PORT` antes de iniciar.

Os testes visuais e de interação estão disponíveis com `npm.cmd run test:browser`, após instalar as dependências de desenvolvimento com `npm.cmd install` e o Chromium com `npx.cmd playwright install chromium`. Usam a porta 3001 e contas separadas em `test-results/`, sem alterar suas contas reais. O teste multiplayer abre dois contextos reais de navegador e verifica presença, movimento, chat, grupo e troca completa.
