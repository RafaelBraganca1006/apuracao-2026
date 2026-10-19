"""Checagem do debate da Band (18/10/2026): afirmações, vereditos e fontes.

Gera site/data/checagem.json a partir de out (debate.json) para achar o minuto de cada fala.
  python3 checagem_items.py
Vereditos: ok Confere · ap Aproximado · ct Falta contexto · im Exagerado ou impreciso · fa Falso · nc Sem confirmação.
Confiança: alta (dado primário/oficial conferido ou 2+ fontes independentes) · média (1 fonte confiável ou checagem de agência) · baixa.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "..", "site", "data", "debate.json")))
LINES = D["lines"]

L, F = "Lula", "Flavio Bolsonaro"
LUPA = {"label": "Lupa · checagem ao vivo do debate", "url": "https://www.agencialupa.org/checagem/2026/10/18/ao-vivo-checagem-do-debate-entre-lula-e-flavio-bolsonaro-na-band/"}


def S(label, url):
    return {"label": label, "url": url}


# snip = trecho (na transcrição) que localiza a fala; n = quantos trechos seguidos formam a citação; gap = busca a partir dessa altura (s)
ITEMS = [
    # ---------------- Segurança ----------------
    dict(who=F, snip="líderes dessas organizações vão ficar até 80 anos presos", n=1, topic="Segurança", verdict="ct", confidence="média",
         text="A Lei Antifacção (Lei 15.358/2026, sancionada em 24/03/2026) prevê reclusão de 20 a 40 anos para o crime de domínio social estruturado. Há aumento de pena para quem exerce comando, mas o Código Penal limita o cumprimento a 40 anos. O número de 80 anos é o teto teórico da soma, não o tempo que alguém cumpre.",
         data="Pena-base de 20 a 40 anos; limite de cumprimento de 40 anos (CP, art. 75).",
         sources=[S("Senado · Lei Antifacção entra em vigor", "https://www12.senado.leg.br/noticias/materias/2026/03/25/lei-antifaccao-de-combate-ao-crime-organizado-entra-em-vigor")], cross=[LUPA]),
    dict(who=L, snip="Eu já fiz a lei antifacção, ela foi aprovada", n=2, topic="Segurança", verdict="ok", confidence="alta",
         text="A Lei Antifacção (Lei 15.358/2026) foi sancionada por Lula em 24/03/2026 e publicada no dia seguinte. Criou tipos penais para facções e milícias e endureceu penas.",
         sources=[S("Senado · Lei Antifacção entra em vigor", "https://www12.senado.leg.br/noticias/materias/2026/03/25/lei-antifaccao-de-combate-ao-crime-organizado-entra-em-vigor")], cross=[LUPA]),
    dict(who=L, snip="a emenda constitucional que eu mandei dia 25 de março", n=2, topic="Segurança", verdict="ap", confidence="média",
         text="A PEC da Segurança Pública (PEC 18/2025) foi enviada pelo governo ao Congresso em 2025; as fontes que encontrei citam abril, não 25 de março. A Câmara a aprovou em março de 2026, a CCJ do Senado concluiu a votação em 14/10/2026 e o plenário do Senado a incluiu na pauta de 15/10. Não achei o resultado dessa votação.",
         sources=[S("Congresso em Foco · PEC da Segurança no Senado", "https://www.congressoemfoco.com.br/noticia/123262/alcolumbre-anuncia-inclusao-da-pec-da-seguranca-na-pauta-desta-quinta"), S("Jornal Opção · pontos da PEC", "https://www.jornalopcao.com.br/politica/veja-os-principais-pontos-da-pec-da-seguranca-publica-que-sera-analisada-pelo-senado-800878/")]),
    dict(who=F, snip="coloca nas ruas marginais perigosos, alegando que não tem vagas", n=2, topic="Segurança", verdict="fa", confidence="média",
         text="Nenhuma norma prevê a soltura de condenados por falta de vagas. A Súmula Vinculante 56 do STF impede manter preso em regime mais rigoroso do que o devido por falta de vagas, mas não autoriza libertação indiscriminada, e o Plano Pena Justa não manda soltar condenados por crimes violentos ou hediondos.",
         sources=[S("STF · Súmula Vinculante 56", "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=26&sumula=2937")], cross=[LUPA]),
    dict(who=L, snip="eles liberaram mais de um milhão de armas", n=2, topic="Segurança", verdict="ct", confidence="média",
         text="O acervo de armas de CACs registrado na Polícia Federal passou de 350.683 (dez/2018) para 1.006.725 (jul/2022), segundo dados obtidos pelos institutos Igarapé e Sou da Paz. Não achei fonte para a afirmação de que parte dessas armas foi para o crime organizado.",
         data="350.683 → 1.006.725 armas de CACs no Sinarm (+287%).",
         sources=[S("Istoé Dinheiro · Igarapé e Sou da Paz", "https://istoedinheiro.com.br/numero-de-armas-registradas-por-cacs-cresce-287-desde-2018-e-ultrapassa-1-milhao")]),
    dict(who=L, snip="Seu pai anunciou a compra de 1 bilhão e 100 milhões", n=3, topic="Segurança", verdict="nc", confidence="baixa",
         text="Não encontrei fonte para 1,1 bilhão de balas. O que há: venda de mais de 420 milhões de munições em 2022 (contra 170 milhões em 2017) e portaria de 2020 que elevou o limite para 600 projéteis por arma, o que permitiria cerca de 227 milhões. A transcrição automática desse trecho está confusa (fala de 'dólares' e 'armas'). Flávio respondeu que o número 'não existe'; também não achei fonte que o confirme ou o descarte.",
         sources=[S("SBT News · munições vendidas em 2022", "https://sbtnews.sbt.com.br/noticia/governo/253616-numero-de-municoes-vendidas-no-brasil-ultrapassa-420-milhoes-em-2022"), S("Jornal de Brasília · venda de munições", "https://jornaldebrasilia.com.br/economia/venda-de-municoes-cresce-24-no-governo-bolsonaro/")]),
    dict(who=F, snip="mais de 40 milhões do Brasil moram", n=2, topic="Segurança", verdict="ap", confidence="média",
         text="Consistente, mas subestimado. A pergunta da própria mediadora citou quase 69 milhões de brasileiros convivendo com facções ou milícias (Datafolha/Fórum Brasileiro de Segurança Pública). Um estudo da Cambridge University Press estima que cerca de 26% dos brasileiros, algo entre 50 e 61 milhões, vivem em áreas sob controle de organizações criminosas.",
         sources=[], cross=[LUPA]),
    dict(who=F, snip="É recorde de mulher assassinada", n=3, topic="Segurança", verdict="ct", confidence="alta",
         text="Feminicídios: 1.571 em 2025, o maior número da série e o quarto recorde seguido (Anuário Brasileiro de Segurança Pública). Mas 'recorde de criminalidade' não vale para mortes violentas: foram 40.775 em 2025, o menor patamar da série iniciada em 2012.",
         data="Feminicídios 1.571 (recorde); mortes violentas intencionais 40.775 (menor da série).",
         sources=[S("Correio Braziliense · Anuário 2026", "https://www.correiobraziliense.com.br/brasil/2026/07/amp/7467099-feminicidios-batem-recorde-em-2025-mostra-anuario-da-seguranca.html"), S("Band · recorde de feminicídios", "https://www.band.com.br/noticias/bora-brasil/ultimas/brasil-registra-novo-recorde-de-feminicidios-em-2025-com-1571-vitimas-202607230956")]),
    dict(who=F, snip="você recebeu o voto de 73%", n=2, topic="Segurança", verdict="im", confidence="média",
         text="Só presos provisórios e adolescentes internados votam (cerca de 13 mil eleitores aptos em 2022). Os dados citados pela Gazeta do Povo mostram Lula com 79,8% no 1º turno e 80,4% no 2º turno de 2022 nas seções prisionais, não 73%. Não achei o número de 73% em fonte do TSE.",
         data="2022: 79,8% (1º turno) e 80,4% (2º turno) nas seções penitenciárias.",
         sources=[S("Gazeta do Povo · voto dos presos em 2022", "https://www.gazetadopovo.com.br/ideias/se-apenas-os-presos-votassem-o-pt-seria-imbativel-veja-os-numeros/")]),
    dict(who=F, snip="Renata Telles foi assassinada", n=3, topic="Segurança", verdict="ct", confidence="média",
         text="O caso existe: Renata da Silva Teles foi morta em Campinas no Natal de 2023 por um homem que estava em saidinha de fim de ano, cumprindo 12 anos por um homicídio anterior. As reportagens que achei descrevem feminicídio, mas não mencionam que ele tivesse sido preso por estupro, como disse o candidato.",
         sources=[S("ABCD Jornal · 'Maníaco do Natal'", "https://abcdjornal.com.br/maniaco-do-natal-tirou-a-vida-de-mulher-durante-saidinha-de-fim-de-ano")]),
    dict(who=F, snip="a família do Sargento PM Dias", n=3, topic="Segurança", verdict="ok", confidence="média",
         text="O sargento Roger Dias da Cunha, da PM de Minas, foi baleado em Belo Horizonte em janeiro de 2024 por um homem que estava em saída temporária. O caso deu nome à 'Lei Sargento PM Dias', sancionada por Lula em 2024 com vetos.",
         sources=[S("Gazeta do Povo · caso do sargento", "https://www.gazetadopovo.com.br/vida-e-cidadania/preso-beneficiado-saidinha-confessa-indiciado-morte-pm/"), S("Itatiaia · recaptura de presos", "https://www.itatiaia.com.br/brasil/sudeste/mg/assassinato-de-sargento-pm-recaptura-25-presos-que-nao-voltaram-de-saidinha-e-procura-outros-48/")]),
    dict(who=F, snip="ele vetou a Saidinha, a gente teve que derrubar", n=3, topic="Segurança", verdict="ct", confidence="média",
         text="Lula vetou trechos da lei que acabou com a 'saidinha' (manteve a saída para visita à família) e o Congresso derrubou o veto em 28/05/2024 (Senado 52 a 11, Câmara 314 a 126). A parte de que o governo 'acionou a Justiça' para a saidinha voltar não aparece em nenhuma fonte que encontrei.",
         sources=[S("Congresso em Foco · veto derrubado", "https://www.congressoemfoco.com.br/area/congresso-nacional/em-derrota-para-lula-congresso-derruba-veto-em-lei-do-fim-das-saidinhas/")]),
    dict(who=L, snip="Você era senador da República e foi interferir", n=2, topic="Segurança", verdict="ct", confidence="baixa",
         text="Flávio Bolsonaro atuou como advogado de defesa do PM acusado de matar uma menina de 5 anos em Niterói (2021) e assinou um recurso ao STJ em 2024, negado. Não achei decisão ou documento mostrando que ele 'interferiu' para o PM não ser preso; a crítica vem de veículos alinhados a Lula.",
         sources=[S("ICL Notícias · defesa do PM", "https://iclnoticias.com.br/flavio-bolsonaro-defesa-pm-acusado-matar-menina/")]),
    dict(who=F, snip="Cadastro Nacional de Pedófilos, que o Lula até hoje não colocou", n=3, topic="Segurança", verdict="nc", confidence="baixa",
         text="A lei que cria o Cadastro Nacional de Pedófilos e Predadores Sexuais (Lei 15.035/2024) foi sancionada por Lula em novembro de 2024, com um veto. Não achei informação sobre o cadastro público já estar ou não no ar, nem sobre a regulamentação.",
         sources=[S("Metrópoles · Câmara aprova o cadastro", "https://www.metropoles.com/brasil/camara-aprova-criacao-de-cadastro-de-pedofilos-e-predadores-sexuais")]),
    dict(who=F, snip="Porto de Santos, por exemplo, é uma área federal", n=3, topic="Segurança", verdict="nc", confidence="baixa",
         text="Não encontrei fonte que classifique Santos como o segundo porto que mais exporta cocaína no mundo. Um relatório do UNODC (2022) cita Santos entre quatro pontos de destaque do comércio marítimo da droga, sem ranking; as apreensões em Santos (23 toneladas em 2018) não permitem comparar volumes exportados.",
         sources=[S("UNODC · apreensão no Porto de Santos", "https://unodc.org/lpo-brazil/en/frontpage/2018/08/federal-revenue-seizes-558-kg-of-cocaine-in-santos-harbor.html")]),
    dict(who=F, snip="mais de 770 mil pessoas morreram assassinadas", n=2, topic="Segurança", verdict="nc", confidence="baixa",
         text="Não achei série oficial que feche esse total. Referências: o Atlas da Violência estima 553 mil mortes por violência intencional entre 2006 e 2016, e há 62.517 homicídios só em 2016. Além disso, 'durante os 20 anos do governo do PT' não bate com o calendário: foram cerca de 17,5 anos (2003 a ago/2016 e desde 2023).",
         sources=[S("Atlas da Violência 2018 (Ipea/FBSP)", "https://static.poder360.com.br/2019/01/Atlas-da-Violencia-2018.pdf")]),

    # ---------------- Economia ----------------
    dict(who=L, snip="a economia cresceu 7,5% e bancarizamos", n=2, topic="Economia", verdict="ok", confidence="alta",
         text="O PIB cresceu 7,5% em 2010, o maior avanço desde 1986 (IBGE). Em outro trecho (09:22) a transcrição automática registrou '10,5%', quase certamente um erro de transcrição; no mesmo debate Lula fala em 7,5% duas vezes. O número de 22 milhões de bancarizados não foi verificado.",
         data="PIB 2010: +7,5% (IBGE).",
         sources=[S("IBGE · PIB 2010", "https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/13983-asi-em-2010-pib-varia-75-e-fica-em-r-3675-trilhoes"), S("IBGE · SIDRA tabela 6784", "https://sidra.ibge.gov.br/tabela/6784")], cross=[LUPA]),
    dict(who=L, snip="somente depois que eu voltei o país começou a crescer", n=2, topic="Economia", verdict="fa", confidence="alta",
         text="O PIB já havia crescido acima de 3% depois de Lula deixar o governo: 4,0% em 2011, 3,0% em 2013, 4,8% em 2021 e 3,0% em 2022 (IBGE). Sob Lula, 2023 foi 3,2%. A afirmação de que só voltou a passar de 3% depois que ele voltou não se sustenta.",
         data="PIB (IBGE): 2011 +4,0% · 2012 +1,9% · 2013 +3,0% · 2014 +0,5% · 2017 +1,3% · 2018 +1,7% · 2019 +1,3% · 2020 −3,3% · 2021 +4,8% · 2022 +3,0% · 2023 +3,2%.",
         sources=[S("IBGE · SIDRA tabela 6784 (variação em volume)", "https://sidra.ibge.gov.br/tabela/6784")]),
    dict(who=L, snip="primeiro presidente da República a conseguir dois graus de investimento", n=2, topic="Economia", verdict="ok", confidence="média",
         text="O Brasil recebeu o grau de investimento da S&P em abril de 2008, da Fitch em maio de 2008 e da Moody's em setembro de 2009. Perdeu em 2015 e 2016 (S&P em set/2015, Fitch em dez/2015, Moody's em fev/2016). Foi a primeira vez que o país obteve o selo, sob Lula.",
         sources=[S("Agência Brasil · entenda o grau de investimento", "https://agenciabrasil.ebc.com.br/economia/noticia/2018-01/entenda-o-grau-de-investimento-de-um-pais"), S("IHU · S&P retira o selo em 2015", "https://ihu.unisinos.br/noticias/546612-agencia-retira-do-brasil-selo-de-bom-pagador-e-poe-em-duvida-o-ajuste")]),
    dict(who=L, snip="devia 30 bilhões para o FMI", n=2, topic="Economia", verdict="nc", confidence="baixa",
         text="O Brasil quitou antecipadamente a dívida com o FMI em dezembro de 2005, com um pagamento de cerca de US$ 15,5 bilhões. Não encontrei fonte oficial para um saldo de US$ 30 bilhões no início de 2003.",
         sources=[S("Istoé Dinheiro · por que pagamos antecipado ao FMI", "https://istoedinheiro.com.br/por-que-pagamos-antecipado-ao-fmi")]),
    dict(who=L, snip="Eu deixei o país com quase 270 bilhões de reservas", n=2, topic="Economia", verdict="im", confidence="alta",
         text="As reservas internacionais fecharam 2010 em US$ 288,575 bilhões (Banco Central), acima dos 'quase 270 bilhões' citados. O valor citado também aparece no trecho das 10:56.",
         data="Reservas em 31/12/2010: US$ 288,575 bi.",
         sources=[S("Canal Rural · reservas de 2010 (BC)", "https://www.canalrural.com.br/agricultura/reservas-internacionais-encerraram-2010-com-288575-bilhoes-18555/")]),
    dict(who=L, snip="nós temos 17 milhões e", n=3, topic="Economia", verdict="ap", confidence="média",
         text="Há cerca de 17,1 milhões de MEIs ativos em 2026: 17,08 milhões segundo estudo da Fecomércio-MG com dados da Receita e 17,16 milhões em junho. O valor de 17,5 milhões é um pouco superior.",
         sources=[S("Fecomércio-MG · Estudo sobre o MEI 2026", "https://fecomerciomg.org.br/wp-content/uploads/2026/07/Estudo-sobre-o-MEI-2026.pdf")]),
    dict(who=L, snip="Da mesma forma que eu anistiei R$ 12 bilhões", n=3, topic="Economia", verdict="ct", confidence="média",
         text="O perdão de dívidas de MEI (PLP 186/2026) soma cerca de R$ 12,6 bilhões, mas foi aprovado pelo Congresso em 14 e 15/10/2026 e ainda aguardava a sanção de Lula na data das reportagens que encontrei. Beneficiaria cerca de 3,6 milhões de MEIs, e não 1,7 milhão (valor que a transcrição registrou; pode ser erro de transcrição).",
         data="R$ 12,6 bi · 3,6 milhões de MEIs · exige requerimento e pagamento em dia nos 6 meses seguintes.",
         sources=[S("Reforma Tributária · Senado aprova, texto vai à sanção", "https://www.reformatributaria.com/reforma-tributaria-congresso-nacional/senado-aprova-novo-teto-de-r-140-mil-para-o-mei-e-perdao-de-dividas-texto-vai-a-sancao-de-lula/"), S("Diário do Nordeste · novas regras do MEI", "https://diariodonordeste.verdesmares.com.br/pontopoder/com-decisao-do-senado-mei-tem-novo-teto-e-perdao-de-dividas-entenda-novas-regras-1.3799045")], cross=[LUPA]),
    dict(who=F, snip="dívida que o atual governo está deixando de 11 trilhões", n=2, topic="Economia", verdict="ok", confidence="alta",
         text="A dívida bruta do governo geral (federal, estados e municípios) foi de R$ 10,8 trilhões em junho de 2026 (81,9% do PIB) e chegou a R$ 11,1 trilhões em agosto (82,9%), segundo o Banco Central. Vale notar que é a dívida do governo geral, não só a federal.",
         data="DBGG: R$ 10,8 tri (jun/2026) · R$ 11,1 tri (ago/2026, 82,9% do PIB).",
         sources=[S("Poder360 · dívida bruta em junho (BC)", "https://www.poder360.com.br/poder-economia/divida-bruta-atinge-819-do-pib-em-junho-diz-banco-central/")], cross=[LUPA]),
    dict(who=F, snip="Ele gastou mais 350 bilhões", n=1, topic="Economia", verdict="ct", confidence="média",
         text="Não achei fonte para R$ 350 bilhões. As estimativas do 'pacote' de medidas em ano eleitoral variam muito com a metodologia: R$ 180 bilhões (Folha), R$ 227 bilhões, R$ 271 bilhões (CNN) e R$ 403 bilhões (Poder360, que inclui programas já existentes como o Bolsa Família). O governo diz que parte das medidas é neutra do ponto de vista fiscal.",
         sources=[S("Poder360 · pacote soma R$ 403,2 bi", "https://www.poder360.com.br/poder-economia/pacote-de-bondades-de-lula-soma-r-4032-bi-em-ano-eleitoral/"), S("Brasil Agro · pacote injeta R$ 270 bi", "https://www.brasilagro.com.br/conteudo/pacote-de-bondades-de-lula-injeta-r-270-bi-na-economia-em-ano-eleitoral.html")]),
    dict(who=F, snip="dar um reajustezinho agora de três reais", n=2, topic="Economia", verdict="ok", confidence="alta",
         text="O governo reajustou o Bolsa Família em 15,04% em setembro de 2026 (efeito em outubro): o piso passou de R$ 600 para R$ 691, ou seja R$ 91 por mês, cerca de R$ 3 por dia. O governo diz que o reajuste só repõe a inflação (INPC de mar/2023 a ago/2026).",
         data="Piso R$ 600 → R$ 691; benefício médio R$ 675 → R$ 777 (estimado).",
         sources=[S("Mercado & Consumo · reajuste de 15%", "https://mercadoeconsumo.com.br/17/09/2026/economia/governo-reajusta-bolsa-familia-em-15-e-eleva-valor-minimo-para-r-691/"), S("DGABC · Bolsa Família reajustado em 15%", "https://www.dgabc.com.br/Noticia/4347515/bolsa-familia-e-reajustado-em-15-medida-vale-a-partir-de-outubro")]),
    dict(who=F, snip="Foi o presidente Bolsonaro que passou para no mínimo R$ 600", n=4, topic="Economia", verdict="im", confidence="média",
         text="O Auxílio Brasil foi criado em 2021 com mínimo de R$ 400. O valor de R$ 600 veio só em agosto de 2022, por emenda constitucional (EC 123/2022, a 'PEC Kamikaze'), e apenas até o fim daquele ano; a tentativa de torná-lo permanente foi rejeitada pela Câmara. A média do Bolsa Família antes era de cerca de R$ 190, como ele disse, mas 'triplicar' ocorreu só em 2022.",
         sources=[S("A Tarde · PEC dos auxílios publicada", "https://atarde.com.br/politica/pec-dos-auxilios-e-publicada-no-diario-oficial-1200719")], cross=[LUPA]),
    dict(who=L, snip="a inflação de alimento estava a 55%", n=4, topic="Economia", verdict="ok", confidence="alta",
         text="Pelo IPCA do IBGE, a alimentação no domicílio subiu 56,1% de 2019 a 2022 e 14,0% de jan/2023 a set/2026, razão de cerca de 4 vezes, como disse Lula. A transcrição automática desse trecho está truncada; os números '55%' e '13%' batem com esses cálculos. No grupo mais amplo 'Alimentação e bebidas' os números são 46,3% e 16,9% (razão menor, de 2,7 vezes).",
         data="Alimentação no domicílio: 56,11% (2019–22) × 14,02% (jan/2023–set/2026). Alimentação e bebidas: 46,25% × 16,88%.",
         sources=[S("IBGE · IPCA, SIDRA tabela 7060", "https://sidra.ibge.gov.br/tabela/7060"), S("IBGE · IPCA, SIDRA tabela 1419 (2019)", "https://sidra.ibge.gov.br/tabela/1419")]),
    dict(who=L, snip="mínimo comprava 1,8 cesta", n=6, topic="Economia", verdict="im", confidence="alta",
         text="Os números estão acima do real. Pelo Dieese, com a cesta de São Paulo, o salário mínimo comprava 1,62 cesta em agosto de 2022 (R$ 1.212 ÷ R$ 749,78) e compra 1,80 cesta em agosto de 2026 (R$ 1.621 ÷ R$ 900,59). Houve melhora de cerca de 11%, mas não de 1,8 para 2,2.",
         data="Ago/2022: 1,62 cesta · Ago/2026: 1,80 cesta (cesta de São Paulo).",
         sources=[S("Dieese · cesta básica, ago/2026", "https://www.dieese.org.br/analisecestabasica/2026/202608cestabasica.pdf"), S("Dieese · cesta básica, ago/2022", "https://www.dieese.org.br/analisecestabasica/2022/202208cestabasica.pdf")], cross=[LUPA]),
    dict(who=L, snip="que tivemos a decência", n=4, topic="Economia", verdict="fa", confidence="alta",
         text="Em 2019 o mínimo passou de R$ 954 para R$ 998 (+4,61%), acima do INPC de 2018 (3,43%), com ganho real de cerca de 1,1%, segundo o Dieese. Em 2020 e 2022 os reajustes ficaram praticamente iguais à inflação, e em 2021 abaixo (5,26% contra 5,45%). 'Nenhum ano' não procede, embora desde 2020 não tenha havido ganho real relevante.",
         data="2019: +4,61% (INPC 3,43%) · 2021: +5,26% (INPC 5,45%).",
         sources=[S("Dieese · nota técnica sobre o mínimo de 2019", "https://www.dieese.org.br/notatecnica/2019/notaTec201SalarioMinimo.pdf"), S("Dieese · nota técnica sobre o mínimo de 2021", "https://www.dieese.org.br/notatecnica/2021/notaTec249salarioMinimo.pdf")]),
    dict(who=L, snip="Nós criamos a nova indústria Brasil e já foi aplicado e investido", n=2, topic="Economia", verdict="ap", confidence="média",
         text="O governo informa R$ 750 bilhões do ciclo 2023–2026 da Nova Indústria Brasil (anúncio de junho de 2026, que inclui R$ 140 bilhões ainda a liberar). A CNI contabiliza R$ 653,2 bilhões aprovados nos dois primeiros anos. O valor de R$ 725 bilhões 'investido' mistura valores aprovados e previstos.",
         sources=[S("Portal da Indústria · R$ 653,2 bi", "https://noticias.portaldaindustria.com.br/noticias/politica-industrial/nova-industria-brasil-ja-investiu-r-6532-bilhoes-em-428-mil-projetos-informa-cni/"), S("O Povo · BNDES anuncia R$ 140 bi", "https://mais.opovo.com.br/jornal/economia/2026/06/23/bndes-anuncia-investimento-de-rs-140-bi-para-nova-industria-brasil-em-2026.html")]),
    dict(who=L, snip="Eles sabem que quando eles governaram o país, ficou efetivamente", n=2, topic="Economia", verdict="fa", confidence="alta",
         text="O governo central fechou 2022 com superávit primário de R$ 54,1 bilhões (0,5% do PIB), segundo o Tesouro, e não com déficit de 2,8%. O resultado foi ajudado pelo adiamento de precatórios; em 2023 foram pagos R$ 92,4 bilhões em precatórios e o déficit chegou a R$ 230,5 bilhões.",
         data="2022: superávit de R$ 54,1 bi (revisado: R$ 46,4 bi, 0,5% do PIB) · 2023: déficit de R$ 230,5 bi.",
         sources=[S("Tesouro Nacional · resultado de 2022", "https://static.poder360.com.br/2023/03/resultado-tesouro-nacional-2022.pdf"), S("Ipea · resultado primário de 2023", "https://www.ipea.gov.br/cartadeconjuntura/index.php/2023/12/estimativa-preliminar-do-resultado-primario-do-governo-central-em-novembro-de-2023/")], cross=[LUPA]),
    dict(who=L, snip="apresentamos um orçamento com superávit de 0,1%", n=2, topic="Economia", verdict="ok", confidence="alta",
         text="O projeto de Orçamento de 2027, entregue em 31/08/2026, prevê superávit primário de R$ 18,6 bilhões, cerca de 0,13% do PIB. A meta formal é de 0,5% do PIB e, descontadas exclusões previstas em lei, o resultado ajustado seria de 0,56%. É um projeto, que ainda será votado.",
         data="PLOA 2027: superávit de R$ 18,6 bi (0,13% do PIB); meta de 0,5%.",
         sources=[S("Câmara · Raio-X do PLOA 2027", "https://www2.camara.leg.br/orcamento-da-uniao/raio-x-do-orcamento/2027/RaioX_PLOA_2027.pdf"), S("Canal Rural · superávit de R$ 18,6 bi", "https://www.canalrural.com.br/radar/governo-preve-superavit-primario-de-r-186-bilhoes-no-orcamento-de-2027/")]),
    dict(who=L, snip="Vão chegar até 300 bilhões", n=3, topic="Economia", verdict="im", confidence="média",
         text="A medida provisória do Desenrola Brasil 3.0 (MP 1.393/2026, de 25/09/2026) prevê que a União compre carteiras de dívidas em leilão com deságio mínimo de 90% (que pode ser maior). O governo estima R$ 150 bilhões em dívidas elegíveis e R$ 75 bilhões renegociados, com gasto de até R$ 15 bilhões da União. Não achei R$ 300 bilhões nem o desconto 'de até 92%'.",
         data="Elegíveis: ~R$ 150 bi · deságio mínimo de 90% · dívidas de até R$ 10 mil.",
         sources=[S("A Crítica · Desenrola 3.0 prevê desconto mínimo de 90%", "https://acritica.net/economia/desenrola-brasil-3-0-preve-desconto-minimo-de-90-e-pode-alcancar-15-milhoes/"), S("Câmara · MP 1.393/2026", "https://www.camara.leg.br/enquetes/2647154")]),
    dict(who=L, snip="eles querem privatizar, eles já falaram, querem privatizar 95%", n=2, topic="Economia", verdict="ct", confidence="baixa",
         text="O programa de governo de Flávio retoma o Programa Nacional de Desestatização 'caso a caso', sem listar empresas. Coordenadores da campanha falaram em 'mais de 20 estatais' e em não ter estatais de telecomunicações. A cifra de 95% aparece apenas no título de uma reportagem de fevereiro de 2026, que não consegui abrir; não achei compromisso dele com a privatização da Petrobras (a equipe de Zema, outro candidato, fala nisso).",
         sources=[S("Convergência Digital · estatais que Flávio quer vender", "https://convergenciadigital.com.br/governo/flavio-bolsonaro-do-pl-quer-vender-telebras-e-outras-estatais-se-vencer-eleicao-presidencial/"), S("Tribuna do Sertão · visão dos candidatos sobre estatais", "https://tribunadosertao.com.br/financas/2026/09/21/982853-petrobras-correios-e-bb-a-visao-dos-presidenciaveis-sobre-as-estatais")]),

    # ---------------- Saúde ----------------
    dict(who=L, snip="716 mil pessoas morreram por irresponsabilidade", n=2, topic="Saúde", verdict="nc", confidence="baixa",
         text="O Brasil passou de 700 mil mortes por covid-19 em março de 2023 (Ministério da Saúde); outra contagem chega a 704.659 em agosto de 2023. Não encontrei o total final de 716 mil. A frase de que metade das mortes poderia ter sido evitada é uma estimativa/opinião que não foi verificada.",
         sources=[S("Carta Capital · marca de 700 mil mortes", "https://www.cartacapital.com.br/saude/covid-19-tres-anos-apos-primeira-morte-brasil-alcanca-a-marca-de-700-mil-mortes-pela-doenca/"), S("Statista · mortes por covid no Brasil", "https://statista.com/statistics/1107109/brazil-coronavirus-deaths-state")]),
    dict(who=L, snip="esse país que tinha tido 18 mil médicos do Mais Médicos", n=4, topic="Saúde", verdict="ap", confidence="média",
         text="O Mais Médicos tinha 12.843 profissionais em dezembro de 2022 e 24.894 em junho de 2024 (Agência Gov); o governo cita cerca de 26,4 mil em agosto de 2025, com meta de 28 mil até 2027. O pico anterior foi de 18.240 (informado em 2018). Não achei o total de 2026. A transcrição registra 'em 2003', o que parece erro: o programa é de 2013 e a retomada é de 2023.",
         sources=[S("Agência Gov · Mais Médicos praticamente dobra (2024)", "https://agenciagov.ebc.com.br/noticias/202407/em-18-meses-mais-medicos-praticamente-dobra-numero-de-profissionais"), S("Agência Gov · Mais Médicos (ago/2025)", "https://agenciagov.ebc.com.br/noticias/202508/mais-medicos-1500-profissionais-987-municipios-e-23-distritos-indigenas")]),
    dict(who=L, snip="41 remédio de uso contínuo", n=2, topic="Saúde", verdict="ok", confidence="média",
         text="O Farmácia Popular oferece 41 itens gratuitos desde a ampliação de fevereiro de 2025, para 11 doenças, além de anticoncepcionais e fraldas geriátricas. Nem todos são 'remédios de uso contínuo', mas a ordem de grandeza confere.",
         sources=[S("Estado de Minas · Farmácia Popular entrega 41 itens", "https://www.em.com.br/emfoco/2026/08/04/farmacia-popular-entrega-41-medicamentos-e-itens-de-graca-para-toda-a-populacao-veja-o-que-levar/")]),

    # ---------------- Corrupção e instituições ----------------
    dict(who=L, snip="de 49 deputados, você foi o único que votou contra", n=2, topic="Corrupção e ética", verdict="ok", confidence="média",
         text="Em 2009 a Alerj aprovou a ampliação da licença-maternidade das servidoras de 4 para 6 meses, e as fontes concordam que Flávio Bolsonaro foi o único voto contrário. O número de deputados presentes varia conforme a fonte (45 a favor e 1 contra em uma; 54 a 1 em outra), então os '49' de Lula não puderam ser confirmados. Nenhuma fonte cita o registro oficial da Alerj.",
         sources=[S("Revista Fórum · Lula lembra o voto", "https://revistaforum.com.br/revista-forum/lula-lembra-voto-de-flavio-bolsonaro-contra-ampliacao-da-licenca-maternidade-mas-senador-nao-responde/"), S("SindJustiça · Alerj aprova licença de seis meses", "https://sindjustica.org.br/alerj-aprova-licenca-maternidade-de-seis-meses-no-servico-publico/")], cross=[LUPA]),
    dict(who=F, snip="o seu sócio do careca", n=2, topic="Corrupção e ética", verdict="ct", confidence="média",
         text="A PF identificou cinco pagamentos de R$ 300 mil (R$ 1,5 milhão) do 'Careca do INSS' a uma empresa de Roberta Luchsinger, amiga de Lulinha, entre nov/2024 e mar/2025. A defesa de Lulinha admite uma viagem a Portugal paga pelo Careca. Roberta nega ter repassado dinheiro a ele. O 'Careca' não era do governo: é um lobista, e o esquema de descontos no INSS vem de 2019.",
         sources=[S("Gazeta do Povo · repasses à empresa de amiga de Lulinha", "https://www.gazetadopovo.com.br/republica/pf-aponta-repasses-do-careca-para-empresa-de-amiga-de-lulinha/")]),
    dict(who=F, snip="Roberta Luchsinger, ela fez acusações muito graves", n=2, topic="Corrupção e ética", verdict="ct", confidence="baixa",
         text="A Lupa registra que, em entrevista à CNN no sábado (17/10), Roberta Luchsinger disse que Lula sabia das reuniões do filho com ministros, e que não há acusação formal contra Lula. Não consegui abrir essa entrevista; encontrei que a PF achou mensagens entre Lulinha e a lobista sobre reuniões com integrantes do governo e que Lula disse não conhecê-la.",
         sources=[S("Correio da Manhã · Lula nega relação com Roberta Luchsinger", "https://www.correiodamanha.com.br/politica/2026/08/314979-lula-nega-relacao-com-roberta-luchsinger-apos-fotos-juntos.html")], cross=[LUPA]),
    dict(who=L, snip="E ele tem três inquéritos", n=2, topic="Corrupção e ética", verdict="ap", confidence="média",
         text="O ministro André Mendonça (STF) autorizou dois inquéritos da PF sobre Lulinha (tráfico de influência ligado ao Ministério da Saúde e à Dataprev) e a PF pediu um terceiro. As reportagens divergem sobre a contagem formal.",
         sources=[S("Diário de Pernambuco · Lulinha será investigado pela terceira vez", "https://www.diariodepernambuco.com.br/politica/2026/08/11720219-lulinha-sera-investigado-pela-terceira-vez-pela-policia-federal.html")], cross=[LUPA]),
    dict(who=F, snip="o seu irmão, o Frei Chico", n=3, topic="Corrupção e ética", verdict="ct", confidence="média",
         text="Frei Chico, irmão de Lula, é vice-presidente do Sindnapi, entidade alvo da Operação Sem Desconto; a PF diz que o sindicato não apresentou documentos de autorização dos descontos. Ele não aparece como investigado e nega irregularidades. O sindicato teria arrecadado R$ 259 milhões em descontos irregulares entre 2019 e 2024.",
         sources=[S("Band · irmão de Lula e o Sindnapi", "https://www.band.com.br/noticias/irmao-de-lula-entra-na-justica-contra-quem-o-associa-a-descontos-e-critica-cpmi-do-inss-202510201345"), S("InfoMoney · Frei Chico", "https://www.infomoney.com.br/?p=2841458")]),
    dict(who=F, snip="roubar 5 milhões de aposentados roubados", n=2, topic="Corrupção e ética", verdict="im", confidence="média",
         text="As estimativas sobre o esquema de descontos associativos no INSS giram em torno de 6 milhões de lesados (uma associação que move ação fala em mais de 7,8 milhões). A CGU apurou que cerca de 97% dos entrevistados não autorizaram os descontos. O prejuízo estimado é de R$ 6,3 bilhões entre 2019 e 2024. O número de 5 milhões fica abaixo dessas estimativas.",
         data="~6 milhões de lesados · R$ 6,3 bi · 97% sem autorização (CGU).",
         sources=[S("Poder360 · CGU sobre os descontos", "https://www.poder360.com.br/poder-justica/cgu-diz-que-98-dos-pensionistas-do-inss-nao-autorizaram-descontos/")]),
    dict(who=L, snip="E já arrecadamos 6 bilhões da quadrilha", n=3, topic="Corrupção e ética", verdict="nc", confidence="média",
         text="O prejuízo estimado do esquema é de R$ 6,3 bilhões (não é valor arrecadado). Até 31/12/2025 o governo havia devolvido R$ 2,82 bilhões a 4,1 milhões de beneficiários, e a Justiça bloqueou R$ 2,8 bilhões. Não achei fonte para R$ 6 bilhões arrecadados nem para R$ 3,5 bilhões já pagos; pode haver dado de 2026 que não localizei.",
         sources=[S("SBT News · ressarcimento chega a R$ 2,82 bi", "https://sbtnews.sbt.com.br/noticia/economia/ressarcimento-de-aposentados-e-pensionistas-por-fraude-no-inss-chega-a-r-2-82-bilhoes")]),
    dict(who=F, snip="Foi a bancada do PT", n=2, topic="Corrupção e ética", verdict="nc", confidence="baixa",
         text="A MP 871/2019 (governo Bolsonaro) previa revalidação periódica dos descontos associativos, e o Congresso alterou o prazo na conversão em lei. Encontrei uma emenda sobre a revalidação, mas a fonte não identifica o autor nem o partido, então não é possível atribuí-la à bancada do PT.",
         sources=[S("Jornal de Brasília · Congresso mudou regras dos descontos", "https://jornaldebrasilia.com.br/noticias/economia/congresso-mudou-regras-e-facilitou-manutencao-de-descontos-irregulares-no-inss/")]),
    dict(who=F, snip="Você foi condenado em primeira instância", n=3, topic="Corrupção e ética", verdict="ct", confidence="média",
         text="Lula foi condenado na Lava Jato em primeira e segunda instâncias. Em março de 2021 o ministro Edson Fachin (STF) anulou quatro processos (triplex, sítio de Atibaia e dois do Instituto Lula) por incompetência da 13ª Vara Federal de Curitiba, e a Justiça Eleitoral/STF deixou de considerá-lo inelegível. A decisão não o declarou inocente. 'Descondenado pelos amigos' é opinião.",
         sources=[S("Congresso em Foco · Fachin anula condenações", "https://congressoemfoco.com.br/justica/lula-fachin-lava-jato")]),
    dict(who=F, snip="O áudio do Vorcaro falou que é teu dinheirinho", n=3, topic="Corrupção e ética", verdict="nc", confidence="média",
         text="A Veja publicou em 09/10/2026 relato atribuído a Daniel Vorcaro sobre cerca de R$ 30 milhões para um documentário sobre Lula. A PF e a PGR afirmam que não houve depoimento nem anexo com esse conteúdo; um advogado de Vorcaro confirmou a voz no áudio e outro disse não reconhecer a autenticidade. Lula nega qualquer vantagem. Não há prova de pagamento. Também não é 'dinheiro por fora' comprovado.",
         sources=[S("Poder360 · PGR e PF: Vorcaro não depôs", "https://www.poder360.com.br/poder-justica/pgr-e-pf-vorcaro-nao-depos-sobre-filme-de-lula/"), S("O Povo · áudio de Vorcaro", "https://mais.opovo.com.br/jornal/politica/2026/10/10/audio-de-vorcaro-fala-de-dinheiro-em-filme-de-lula-pf-e-pgr-negam-que-esteja-em-delacao.html")], cross=[LUPA]),
    dict(who=F, snip="Não foi você que prendeu o Vorcaro", n=2, topic="Corrupção e ética", verdict="ok", confidence="alta",
         text="Daniel Vorcaro foi preso em 04/03/2026 por ordem do ministro André Mendonça (STF), relator dos inquéritos, a pedido da Polícia Federal. A PF cumpriu a ordem; a decisão de prender foi judicial.",
         sources=[S("Diário de Pernambuco · prisão mantida pela 2ª Turma", "https://www.diariodepernambuco.com.br/brasil/2026/03/11710421-gilmar-mendes-vota-prisao-de-vorcaro-e-mantida-por-unanimidade.html"), S("Poder360 · 2ª Turma julgará a prisão", "https://www.poder360.com.br/poder-justica/2a-turma-do-stf-julgara-prisao-de-vorcaro-na-6a/")]),
    dict(who=L, snip="60 bilhões de reais.", n=1, topic="Corrupção e ética", verdict="ap", confidence="média",
         text="Não há estimativa oficial do prejuízo total do Banco Master. O rombo no FGC é de quase R$ 52 bilhões (Poder360), próximo do valor citado; uma entidade de policiais federais fala em até R$ 500 bilhões, sem respaldo oficial.",
         sources=[S("Poder360 · Master deixa rombo de R$ 52 bi no FGC", "https://www.poder360.com.br/poder-justica/master-deixa-rombo-de-r-52-bi-no-fgc-e-prejuizo-de-r-2-bi-em-fundos/")]),
    dict(who=L, snip="a casa de 10 milhões", n=2, topic="Corrupção e ética", verdict="im", confidence="média",
         text="A casa de Flávio Bolsonaro no Lago Sul foi comprada por R$ 5,97 milhões (cerca de R$ 6 milhões), com entrada de R$ 2,87 milhões e financiamento de R$ 3,1 milhões do BRB, segundo a imprensa. O Ministério Público do DF investigou o financiamento. O valor citado por Lula (R$ 10 milhões) é cerca de 70% maior.",
         data="Preço: R$ 5,97 mi · financiamento BRB: R$ 3,1 mi.",
         sources=[S("Congresso em Foco · quitação do financiamento", "https://www.congressoemfoco.com.br/noticia/29101/flavio-bolsonaro-quita-mansao-com-seis-pagamentos-extras-de-r-34-milhoes"), S("Jornal de Brasília · MP investiga o empréstimo", "https://jornaldebrasilia.com.br/noticias/politica-e-poder/ministerio-publico-investiga-emprestimo-de-banco-a-flavio-bolsonaro-para-compra-de-mansao/")]),
    dict(who=L, snip="apartamento de 190 metros quadrados", n=2, topic="Corrupção e ética", verdict="nc", confidence="baixa",
         text="Na declaração ao TSE (08/08/2026) Lula informa 50% de um apartamento em São Bernardo do Campo por R$ 94.571 (valor declarado, não de mercado) e patrimônio total de R$ 4,77 milhões. Não achei a metragem nem o valor de mercado de R$ 1,5 milhão.",
         sources=[S("Band · patrimônio declarado de Lula", "https://www.band.com.br/politica/eleicoes/2026/lula-declara-ao-tse-patrimonio-de-r-47-mi-valor-e-35-menor-que-em-2022-202608081928")]),
    dict(who=L, snip="O pai dele mentia 11 vezes por dia", n=1, topic="Corrupção e ética", verdict="im", confidence="média",
         text="O Aos Fatos contabilizou 6.676 declarações falsas ou distorcidas de Jair Bolsonaro em quatro anos de governo, cerca de 4,6 por dia, e 3 por dia nos dois primeiros anos. Não achei fonte para 11 por dia nem para a contagem de '43 mentiras' atribuída a Flávio.",
         data="Aos Fatos: 6.676 em 4 anos (~4,6/dia).",
         sources=[S("Aos Fatos · as mentiras de Bolsonaro", "https://www.aosfatos.org/noticias/mentiras-bolsonaro/"), S("CUT · 4,58 por dia (levantamento do Aos Fatos)", "https://www.cut.org.br/noticias/mentiroso-contumaz-bolsonaro-fez-falsas-declaracoes-4-5-vezes-ao-dia-na-presiden-8bbe/")]),
    dict(who=L, snip="Aliás, ele nunca trabalhou", n=2, topic="Corrupção e ética", verdict="im", confidence="média",
         text="Flávio Bolsonaro é formado em Direito e atua como advogado, foi sócio de uma franquia da Kopenhagen (Bolsotini, aberta em 2015 e deixada em 2021), deputado estadual no Rio de 2003 a 2019 e senador desde 2019. 'Nunca trabalhou' é exagero; o que se pode discutir é o tipo de experiência profissional fora da política.",
         sources=[S("Poder360 · Flávio e a atividade empresarial", "https://www.poder360.com.br/governo/flavio-bolsonaro-fez-patrimonio-antes-de-se-declarar-empresario-diz-jornal/")]),

    # ---------------- Política e relações exteriores ----------------
    dict(who=F, snip="A sétima eleição", n=2, topic="Política", verdict="ok", confidence="média",
         text="Lula disputa a Presidência pela sétima vez (1989, 1994, 1998, 2002, 2006, 2022 e 2026). A candidatura de 2018 foi barrada pela Justiça Eleitoral e não entra na conta.",
         sources=[S("Agência Brasil · Lula disputa pela sétima vez", "https://agenciabrasil.ebc.com.br/es/node/1700017")]),
    dict(who=F, snip="Por que eu votei a favor para acabar com a escala 6x1", n=3, topic="Política", verdict="ok", confidence="alta",
         text="Flávio votou a favor da PEC do fim da escala 6x1 no Senado em 14/10/2026 (75 votos a favor e 1 contra em cada turno), de forma remota, pelo aplicativo. Ele havia criticado o texto e anunciou a mudança de posição em 13/10, depois de ser cobrado por Lula.",
         sources=[S("O Liberal · Flávio vota a favor da PEC", "https://www.oliberal.com/politica/apos-mudar-de-ideia-flavio-bolsonaro-vota-a-favor-da-pec-do-fim-da-escala-6x1-1.1182711"), S("DOL · como votaram os senadores", "https://dol.com.br/noticias/brasil/965565/fim-da-escala-6x1-veja-como-votaram-os-senadores")]),
    dict(who=F, snip="O seu amigo, que é o Maduro, que está preso", n=2, topic="Política", verdict="ok", confidence="alta",
         text="Nicolás Maduro foi capturado por forças dos EUA em 03/01/2026 e está preso em Nova York; o julgamento foi marcado para 1º/06/2027.",
         sources=[S("Band · Maduro é levado para prisão em Nova York", "https://www.band.com.br/noticias/brasil-urgente/ultimas/maduro-chega-aos-estados-unidos-e-sera-levado-para-prisao-em-nova-york-202601031905"), S("Diário de Pernambuco · julgamento em junho de 2027", "https://www.diariodepernambuco.com.br/mundo/2026/07/11719335-justica-dos-estados-unidos-marca-julgamento-de-maduro-para-junho-de-2027.html")]),
    dict(who=F, snip="Você mandou o seu vice-presidente para visitar a posse", n=2, topic="Política", verdict="ct", confidence="alta",
         text="O vice-presidente Geraldo Alckmin representou o Brasil na posse do presidente iraniano Masoud Pezeshkian, em Teerã, em 30/07/2024. A caracterização do governo iraniano como 'ditadura' é opinião política; a cerimônia foi de um presidente eleito, em um sistema em que o poder final está com o líder supremo.",
         sources=[S("SBT News · Alckmin viaja ao Irã", "https://sbtnews.sbt.com.br/noticia/mundo/alckmin-viaja-ao-ira-para-representar-o-brasil-em-posse-de-novo-presidente")]),
    dict(who=L, snip="O seu irmão está fugido nos Estados Unidos", n=2, topic="Política", verdict="ct", confidence="média",
         text="Eduardo Bolsonaro mora nos EUA desde fevereiro de 2025 e foi condenado em junho de 2026 pela 1ª Turma do STF, por coação no curso do processo, a 4 anos e 2 meses (regime semiaberto), por atuar junto a autoridades americanas por sanções contra o Brasil. Não encontrei mandado de prisão; 'fugido' é imprecisão: ele deixou o país antes de ser réu.",
         sources=[S("Congresso em Foco · 1ª Turma condena Eduardo", "https://www.congressoemfoco.com.br/noticia/119704/1a-Turma-do-STF-condena-Eduardo-por-coa%C3%A7%C3%A3o-em-curso-de-processo"), S("Band · STF libera julgamento", "https://www.band.com.br/politica/noticias/stf-libera-julgamento-de-processo-contra-eduardo-bolsonaro-por-coacao-202606031532")]),
    dict(who=F, snip="ninguém trabalhou para tarifar a empresa brasileira", n=4, topic="Política", verdict="im", confidence="média",
         text="O governo Lula negociou com os EUA por meio de Alckmin, Haddad e do Itamaraty (reportagem de julho de 2025), então 'não mandou ninguém' é impreciso. Sobre a viagem de Flávio, a Reuters (via InfoMoney) relata que, em 2026, ele foi a Washington pedir o adiamento de uma tarifa de 25% sobre o Brasil até depois das eleições; ele diz ter ido defender as empresas e nega ter provocado a tarifa, e Lula o acusa do contrário. Não há prova pública que resolva essa disputa.",
         sources=[S("InfoMoney · Flávio vai aos EUA pedir adiamento de tarifas", "https://infomoney.com.br/mercados/em-disputa-com-lula-flavio-vai-aos-eua-pedir-adiamento-de-tarifas-sobre-o-brasil"), S("Correio Braziliense · canais do governo antes do tarifaço (jul/2025)", "https://edicao.correiobraziliense.com.br/correiobraziliense/2025/07/26/145233/pdf/A02-POL-2607-DIG.pdf")]),
    dict(who=F, snip="Você me respeita que eu tive 56 milhões de votos", n=1, topic="Política", verdict="ok", confidence="alta",
         text="No 1º turno de 2026, Flávio Bolsonaro teve 56.104.503 votos (47,03% dos votos válidos), segundo a totalização do TSE. Lula teve 53.879.538 (45,16%).",
         data="Flávio 56.104.503 (47,03%) · Lula 53.879.538 (45,16%).",
         sources=[S("TSE · resultados do 1º turno", "https://resultados.tse.jus.br")]),
    dict(who=F, snip="O PT já governa esse país há 20 anos, dos últimos 24", n=1, topic="Política", verdict="im", confidence="alta",
         text="Pelo calendário, o PT esteve na Presidência de 2003 a agosto de 2016 (Lula e Dilma, cerca de 13,7 anos) e desde 2023 (cerca de 3,8 anos até outubro de 2026): aproximadamente 17,5 anos dos últimos 24, e não 20. Cálculo próprio a partir das datas dos mandatos.",
         data="2003–ago/2016 ≈ 13,7 anos + 2023–out/2026 ≈ 3,8 anos = ~17,5 anos.",
         sources=[]),
]

METHOD = """<p><b>O que checamos.</b> Afirmações <u>factuais e verificáveis</u> (números, datas, leis, votações, fatos históricos) ditas pelos <b>dois candidatos</b>, com o mesmo critério. Promessas, opiniões, ataques pessoais e perguntas retóricas não são checados. Escolhemos as falas que podiam ser conferidas com dados públicos; não é a lista completa de tudo o que foi dito.</p>
<p><b>De onde vem o texto.</b> A transcrição é automática (reconhecimento de voz) e pode errar números e nomes. Corrigimos a grafia dos nomes próprios mais óbvios (como Vorcaro, Mendonça e Luchsinger), mas ainda pode restar algum erro. Quando um trecho parece ter sido transcrito errado, dizemos isso no item, e a citação aparece exatamente como transcrita.</p>
<p><b>Fontes.</b> Damos preferência a dados oficiais (IBGE, Banco Central, Tesouro, TSE, Dieese, Congresso, Planalto, STF). Em seguida, checagens de agências (Lupa) e imprensa. Onde foi possível, calculamos o número nós mesmos a partir da série oficial (por exemplo, PIB, inflação de alimentos e salário mínimo em cestas básicas). Cada item mostra as fontes e, quando existe, a checagem de outra agência.</p>
<p><b>Vereditos.</b></p>
<ul>
<li><b>Confere</b>: o essencial está correto.</li>
<li><b>Aproximado</b>: correto na ordem de grandeza, com diferença pequena.</li>
<li><b>Falta contexto</b>: há base factual, mas a frase omite algo que muda a interpretação.</li>
<li><b>Exagerado ou impreciso</b>: o dado existe, mas o número ou a conclusão está inflado, trocado ou distorcido.</li>
<li><b>Falso</b>: contraria os dados oficiais.</li>
<li><b>Sem confirmação</b>: não encontramos fonte confiável para confirmar ou desmentir. Isso <u>não</u> significa que seja falso.</li>
</ul>
<p><b>Confiança.</b> <i>Alta</i>: dado oficial conferido por nós ou duas ou mais fontes independentes. <i>Média</i>: uma fonte confiável ou uma agência de checagem. <i>Baixa</i>: poucas fontes ou fonte indireta.</p>
<p><b>Limites.</b> Esta checagem foi feita com apoio de inteligência artificial a partir de fontes públicas, em 18 e 19/10/2026, e pode conter erros. Alguns dados mudam (por exemplo, a sanção de projetos ou novos balanços); os itens valem para a data da consulta.</p>"""


def locate(snip, n):
    for i, l in enumerate(LINES):
        if snip.lower() in l["text"].lower():
            return l["t"], " ".join(x["text"] for x in LINES[i:i + n])
    return None, None


def main():
    out, missing = [], []
    for k, it in enumerate(ITEMS):
        t, quote = locate(it.pop("snip"), it.pop("n", 2))
        if t is None:
            missing.append(k)
            continue
        it.update(id=f"c{k + 1}", t=t, quote=quote.strip())
        out.append(it)
    out.sort(key=lambda x: x["t"])
    path = os.path.join(HERE, "..", "site", "data", "checagem.json")
    json.dump({"note": "Checagem feita com apoio de inteligência artificial sobre a transcrição automática; pode conter erros.", "method": METHOD, "items": out},
              open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    from collections import Counter
    print(len(out), "itens;", Counter(i["verdict"] for i in out), Counter(i["who"] for i in out))
    if missing:
        print("NÃO LOCALIZADOS:", [ITEMS[k].get("topic") for k in missing], missing)


if __name__ == "__main__":
    main()
