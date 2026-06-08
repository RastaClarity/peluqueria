// Datos de avatar, presets, cosméticos y tienda de personalización.
// Extraído de App.jsx en Rasta Cuts 2.9.3g para reducir tamaño del archivo principal.

export const AVATARS = ["🧑","👩","👨","👱","👩‍🦱","👨‍🦱","🧔","👩‍🦰","👨‍🦰","👩‍🦳","👨‍🦳","🧑🏾‍🎤","👩🏽‍🎤","👨🏽‍🎤","👩🏽‍🦱","👨🏽‍🦱"];

export const AVATAR_STYLES = [
  {emoji:"🧑🏽‍🎤",name:"Rasta Neo",tag:"rastas marcadas",bg:"linear-gradient(145deg,#3A1E10,#D4AF37)"},
  {emoji:"👩🏽‍🎤",name:"Punk Queen",tag:"undercut rebelde",bg:"linear-gradient(145deg,#5C0F0F,#F06A3B)"},
  {emoji:"🧔🏽‍♂️",name:"Barber Boss",tag:"barba pro",bg:"linear-gradient(145deg,#130906,#8B4513)"},
  {emoji:"👨🏽‍🦱",name:"Afro Pop",tag:"volumen 3D",bg:"linear-gradient(145deg,#1A3A5C,#E1A85D)"},
  {emoji:"👩🏽‍🦱",name:"Curl Star",tag:"rizos grandes",bg:"linear-gradient(145deg,#6E3518,#FFF1A8)"},
  {emoji:"👩🏼‍🎨",name:"Color Splash",tag:"mechas fantasía",bg:"linear-gradient(145deg,#C0392B,#D4AF37)"},
  {emoji:"🧑🏾‍🦱",name:"Dread Master",tag:"rastas largas",bg:"linear-gradient(145deg,#24110A,#9A4F22)"},
  {emoji:"👱🏽‍♀️",name:"Blonde Blade",tag:"bob luminoso",bg:"linear-gradient(145deg,#D4AF37,#FFF4D6)"},
  {emoji:"🧑🏻‍🎤",name:"Cyber Punk",tag:"neón urbano",bg:"linear-gradient(145deg,#150B07,#C0392B)"},
  {emoji:"👩🏾‍🦳",name:"Silver Flow",tag:"plata premium",bg:"linear-gradient(145deg,#6E3518,#EDE1C8)"},
  {emoji:"🧑🏽",name:"Fresh Cut",tag:"degradado limpio",bg:"linear-gradient(145deg,#3A1E10,#C97934)"},
  {emoji:"👨🏾‍🎤",name:"Rock Fade",tag:"crestón punk",bg:"linear-gradient(145deg,#8B0000,#2C1810)"},
];

export const MALE_HAIR = ["buzzFade","texturedCrop","sharpFade","dreadsLong","dreadsBun","dreadsTop","afro","mohawk","undercut","shortLocs","twistsTop","locPonytail"];

export const FEMALE_HAIR = ["longWaves","braidsLong","curlyBob","highPonytail","bob","pixie","afroPuff","dreadsLong","dreadsBun","undercut","spaceBuns","sideBraids","longStraight"];

export const BEARD_VALUES = ["stubble","moustache","goatee","shortBeard","beard","full"];

export const BASIC_ACCESSORIES = ["none","earring","hoopGold","glasses","bandana","cap","piercing","flowers","headphones"];

export const AVATAR_OPTIONS = {
  gender:["male","female"],
  skin:["#F7C79C","#E9A578","#C98258","#9B5A38","#6E3B24","#4B2719"],
  hairColor:["#14100C","#3B2414","#6A3B1F","#B86A2E","#D4AF37","#8B0000","#145C8A","#663399","#EDE1C8","#E66A9A","#21A35B"],
  eyeColor:["#1A120C","#5B341A","#1A3A5C","#2F6B42","#7B3FA1","#D4AF37"],
  face:["oval","round","sharp","square","heart","long"],
  hair:[...new Set([...MALE_HAIR,...FEMALE_HAIR])],
  brows:["soft","strong","angry","thin","arched"],
  nose:["sharp","soft","long","small","wide","hook"],
  mouth:["soft","smile","serious","smirk","sharp","open"],
  eyes:["anime","sleepy","sharp","round","smile","glam"],
  facial:["none",...BEARD_VALUES],
  accessory:["none","earring","hoopGold","glasses","glassesGold","bandana","bandanaGreen","cap","capBlack","capGold","piercing","flowers","headphones","crown"],
  bg:["gold","dark","red","blue","paper","studio","street","royal","office","beach","setup","camper","terrace","reggae","barberShop","vipRoom"],
  frame:["none","bronze","gold","neon","legend"],
  aura:["none","warm","flame","ocean","vip"]
};

export const DEFAULT_AVATAR_CONFIG = {
  version:"2.1.0",
  gender:"male",
  skin:2,
  hair:"sharpFade",
  hairColor:0,
  face:"square",
  eyes:"sharp",
  eyeColor:0,
  brows:"strong",
  nose:"soft",
  mouth:"smile",
  facial:"shortBeard",
  accessory:"none",
  bg:"gold",
  frame:"none",
  aura:"none"
};

export const DEFAULT_MALE_AVATAR = {
  version:"2.1.0",
  gender:"male",
  skin:2,
  hair:"sharpFade",
  hairColor:0,
  face:"square",
  eyes:"sharp",
  eyeColor:0,
  brows:"strong",
  nose:"soft",
  mouth:"smile",
  facial:"shortBeard",
  accessory:"none",
  bg:"street",
  frame:"none",
  aura:"none"
};

export const DEFAULT_FEMALE_AVATAR = {
  version:"2.1.0",
  gender:"female",
  skin:1,
  hair:"longWaves",
  hairColor:9,
  face:"heart",
  eyes:"glam",
  eyeColor:2,
  brows:"arched",
  nose:"small",
  mouth:"soft",
  facial:"none",
  accessory:"hoopGold",
  bg:"paper",
  frame:"none",
  aura:"none"
};

export const AVATAR_PRESETS = [
  {gender:"male",skin:3,hair:"dreadsLong",hairColor:1,face:"square",eyes:"sharp",eyeColor:3,brows:"strong",facial:"shortBeard",accessory:"bandanaGreen",bg:"dark"},
  {gender:"female",skin:2,hair:"braidsLong",hairColor:2,face:"heart",eyes:"glam",eyeColor:3,brows:"arched",facial:"none",accessory:"hoopGold",bg:"gold"},
  {gender:"male",skin:4,hair:"locPonytail",hairColor:0,face:"oval",eyes:"round",eyeColor:2,brows:"strong",facial:"beard",accessory:"earring",bg:"street"},
  {gender:"female",skin:3,hair:"longWaves",hairColor:4,face:"oval",eyes:"sharp",eyeColor:5,brows:"strong",facial:"none",accessory:"bandana",bg:"red"},
  {gender:"male",skin:2,hair:"mohawk",hairColor:0,face:"sharp",eyes:"sharp",eyeColor:0,brows:"angry",facial:"goatee",accessory:"piercing",bg:"paper"},
  {gender:"female",skin:5,hair:"spaceBuns",hairColor:1,face:"round",eyes:"smile",eyeColor:3,brows:"soft",facial:"none",accessory:"flowers",bg:"studio"},
  {gender:"male",skin:1,hair:"sharpFade",hairColor:3,face:"square",eyes:"glam",eyeColor:4,brows:"thin",facial:"stubble",accessory:"capBlack",bg:"royal"},
  {gender:"female",skin:1,hair:"undercut",hairColor:9,face:"sharp",eyes:"anime",eyeColor:4,brows:"angry",facial:"none",accessory:"glassesGold",bg:"dark"},
  {gender:"male",skin:5,hair:"afro",hairColor:0,face:"long",eyes:"sleepy",eyeColor:1,brows:"soft",facial:"full",accessory:"glasses",bg:"blue"},
  {gender:"female",skin:0,hair:"curlyBob",hairColor:8,face:"heart",eyes:"glam",eyeColor:2,brows:"arched",facial:"none",accessory:"capGold",bg:"gold"},
  {gender:"male",skin:3,hair:"dreadsTop",hairColor:4,face:"oval",eyes:"round",eyeColor:4,brows:"strong",facial:"moustache",accessory:"bandana",bg:"red"},
  {gender:"female",skin:4,hair:"highPonytail",hairColor:7,face:"long",eyes:"sharp",eyeColor:1,brows:"strong",facial:"none",accessory:"piercing",bg:"blue"},
  {gender:"male",skin:1,hair:"buzzFade",hairColor:0,face:"heart",eyes:"anime",eyeColor:5,brows:"arched",facial:"none",accessory:"crown",bg:"royal"},
  {gender:"female",skin:2,hair:"bob",hairColor:6,face:"square",eyes:"sleepy",eyeColor:2,brows:"thin",facial:"none",accessory:"earring",bg:"paper"},
  {gender:"male",skin:2,hair:"twistsTop",hairColor:5,face:"round",eyes:"sharp",eyeColor:3,brows:"angry",facial:"shortBeard",accessory:"headphones",bg:"setup"},
  {gender:"female",skin:2,hair:"sideBraids",hairColor:10,face:"oval",eyes:"round",eyeColor:0,brows:"strong",facial:"none",accessory:"bandanaGreen",bg:"terrace"},
];

export const AVATAR_PRESET_NAMES = [
  "Capitán Dread","Reina Marea","Corsario Rasta","Sirena Rebelde",
  "Mohawk Pirata","Afro Caribe","Barber Urbano","Neón Caribe",
  "Guardia del Puerto","Dama Dorada","Rasta del Muelles","Ponytail Punk",
  "Leyenda Barber","Bob de Taberna","Beat del Puerto","Dread Esmeralda"
];

export const AVATAR_LABELS = {
  gender:"Sexo",male:"Masculino",female:"Femenino",skin:"Piel",hair:"Peinado",hairColor:"Color pelo",face:"Cara",eyes:"Ojos",eyeColor:"Color ojos",brows:"Cejas",facial:"Barba/bigote",accessory:"Complemento",bg:"Fondo",
  oval:"Ovalada",square:"Cuadrada",heart:"Corazón",long:"Alargada",
  buzzFade:"Rapado fade",texturedCrop:"Crop texturizado",sharpFade:"Degradado limpio",dreadsLong:"Rastas largas",dreadsBun:"Nudo rasta",dreadsTop:"Rastas arriba",afro:"Afro redondo",afroPuff:"Afro puff",braidsLong:"Trenzas largas",curlyBob:"Rizos bob",longWaves:"Melena ondas",highPonytail:"Coleta alta",bob:"Bob liso",pixie:"Pixie corto",mohawk:"Cresta punk",undercut:"Undercut",shortLocs:"Rastas cortas",twistsTop:"Twists altos",locPonytail:"Rastas recogidas",spaceBuns:"Doble moño",sideBraids:"Trenzas laterales",longStraight:"Melena lisa",
  soft:"Suaves",strong:"Marcadas",angry:"Intensas",thin:"Finas",arched:"Arqueadas",anime:"Anime",sleepy:"Relajados",smile:"Sonrientes",glam:"Glam",sharp:"Afilada",longNose:"Larga",small:"Pequeña",wide:"Ancha",hook:"Curvada",serious:"Seria",smirk:"Media sonrisa",open:"Abierta",
  none:"Nada",stubble:"Sombra",moustache:"Bigote",goatee:"Perilla",shortBeard:"Barba corta",beard:"Barba",full:"Barba completa",
  earring:"Pendiente",glasses:"Gafas",bandana:"Bandana",cap:"Gorra",piercing:"Piercing",capBlack:"Gorra negra",capGold:"Gorra dorada",glassesGold:"Gafas doradas",bandanaGreen:"Bandana verde",crown:"Corona barber",hoopGold:"Aros dorados",flowers:"Flores",headphones:"Cascos",
  office:"Oficina",beach:"Playa",setup:"Setup gamer",camper:"Camper",terrace:"Terraza chill",reggae:"Escenario reggae",barberShop:"Barber studio",vipRoom:"Sala VIP",gold:"Dorado",dark:"Oscuro",red:"Rojo",blue:"Azul",paper:"Papiro",studio:"Estudio",street:"Calle",royal:"VIP",bronze:"Bronce",neon:"Neón",legend:"Leyenda",warm:"Brillo cálido",flame:"Aura fuego",ocean:"Aura mar",vip:"Aura VIP"
};

export const COSMETIC_CATALOG_FALLBACK = [
  {item_key:"bandana_green",icono:"🟢",nombre:"Bandana Isla Verde",descripcion:"Bandana rasta de puerto. Primer desbloqueable útil para empezar a personalizar.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"accessory",valor:"bandanaGreen",puntos_precio:180,rareza:"comun",activo:true},
  {item_key:"frame_bronze",icono:"🟤",nombre:"Marco Bronce del Muelle",descripcion:"Marco básico de perfil con borde envejecido.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"frame",valor:"bronze",puntos_precio:220,rareza:"comun",activo:true},
  {item_key:"cap_black",icono:"🧢",nombre:"Gorra Negra Barber",descripcion:"Gorra urbana para avatar pirata/rasta.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"accessory",valor:"capBlack",puntos_precio:260,rareza:"comun",activo:true},
  {item_key:"bg_paper",icono:"🗺️",nombre:"Fondo Mapa Antiguo",descripcion:"Fondo tipo pergamino para perfil y avatar.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"paper",puntos_precio:300,rareza:"comun",activo:true},
  {item_key:"glasses_gold",icono:"🕶️",nombre:"Gafas Doradas del Puerto",descripcion:"Gafas de marco dorado para destacar en comunidad.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"accessory",valor:"glassesGold",puntos_precio:420,rareza:"raro",activo:true},
  {item_key:"bg_street",icono:"🏴‍☠️",nombre:"Fondo Callejón Barber",descripcion:"Escenario urbano de barbería y puerto.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"street",puntos_precio:480,rareza:"raro",activo:true},
  {item_key:"cap_gold",icono:"🧢",nombre:"Gorra Dorada de Capitán",descripcion:"Gorra premium con brillo dorado.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"accessory",valor:"capGold",puntos_precio:650,rareza:"raro",activo:true},
  {item_key:"frame_gold",icono:"🟡",nombre:"Marco Oro Caribe",descripcion:"Marco dorado para perfiles con progreso real.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"frame",valor:"gold",puntos_precio:760,rareza:"raro",activo:true},
  {item_key:"bg_royal",icono:"👑",nombre:"Fondo Camarote VIP",descripcion:"Fondo de perfil con ambiente de camarote exclusivo.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"royal",puntos_precio:900,rareza:"epico",activo:true},
  {item_key:"bg_office",icono:"🏢",nombre:"Fondo Oficina Creativa",descripcion:"Fondo divertido de oficina para perfil y avatar.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"office",puntos_precio:260,rareza:"comun",activo:true},
  {item_key:"bg_beach",icono:"🏖️",nombre:"Fondo Playa Chill",descripcion:"Playa cálida para perfiles con vibra verano.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"beach",puntos_precio:360,rareza:"comun",activo:true},
  {item_key:"bg_setup",icono:"🖥️",nombre:"Fondo Setup Gamer",descripcion:"Setup moderno para perfiles digitales.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"setup",puntos_precio:520,rareza:"raro",activo:true},
  {item_key:"bg_camper",icono:"🚐",nombre:"Fondo Camper",descripcion:"Ruta, libertad y barbería con ruedas.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"camper",puntos_precio:640,rareza:"raro",activo:true},
  {item_key:"bg_terrace",icono:"🌿",nombre:"Fondo Terraza Chill",descripcion:"Terraza verde para perfiles tranquilos.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"terrace",puntos_precio:720,rareza:"raro",activo:true},
  {item_key:"bg_reggae",icono:"🎛️",nombre:"Fondo Escenario Reggae",descripcion:"Fondo musical con colores rasta.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"reggae",puntos_precio:980,rareza:"epico",activo:true},
  {item_key:"bg_barber_shop",icono:"💈",nombre:"Fondo Barber Studio",descripcion:"Estudio barber premium para avatar.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"barberShop",puntos_precio:1250,rareza:"epico",activo:true},
  {item_key:"bg_vip_room",icono:"🛋️",nombre:"Fondo Sala VIP",descripcion:"Sala VIP legendaria para perfiles top.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"vipRoom",puntos_precio:1800,rareza:"legendario",activo:true},
  {item_key:"aura_warm",icono:"🔥",nombre:"Aura Atardecer Caribe",descripcion:"Brillo cálido alrededor del avatar.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"aura",valor:"warm",puntos_precio:1100,rareza:"epico",activo:true},
  {item_key:"frame_neon",icono:"💠",nombre:"Marco Neón Taberna",descripcion:"Marco urbano luminoso para destacar.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"frame",valor:"neon",puntos_precio:1300,rareza:"epico",activo:true},
  {item_key:"aura_flame",icono:"🔥",nombre:"Aura Fuego del Barbero",descripcion:"Aura intensa para perfiles veteranos.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"aura",valor:"flame",puntos_precio:1500,rareza:"epico",activo:true},
  {item_key:"bg_dark",icono:"🌙",nombre:"Fondo Noche en el Muelle",descripcion:"Fondo oscuro de puerto nocturno.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"bg",valor:"dark",puntos_precio:1700,rareza:"epico",activo:true},
  {item_key:"aura_ocean",icono:"🌊",nombre:"Aura Marea Verde",descripcion:"Aura fresca de mar y reggae.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"aura",valor:"ocean",puntos_precio:2100,rareza:"legendario",activo:true},
  {item_key:"crown_barber",icono:"👑",nombre:"Corona Leyenda Barber",descripcion:"Corona especial para perfiles de leyenda.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"accessory",valor:"crown",puntos_precio:2600,rareza:"legendario",activo:true},
  {item_key:"frame_legend",icono:"🏆",nombre:"Marco Leyenda Rasta",descripcion:"Marco final de prestigio para el perfil.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"frame",valor:"legend",puntos_precio:3200,rareza:"legendario",activo:true},
  {item_key:"aura_vip",icono:"✨",nombre:"Aura VIP Dorada",descripcion:"Aura máxima para avatar y perfil.",categoria:"avatar",tipo:"cosmetico_avatar",slot:"aura",valor:"vip",puntos_precio:3600,rareza:"legendario",activo:true}
];

export const PERSONALIZATION_SHOP_EXTRA = [
  {id:"title_fresh_cut",item_key:"title_fresh_cut",icono:"🏷️",nombre:"Título: Corte Fresco",descripcion:"Título visible para tu perfil. Personalización web, no Tycoon.",categoria:"avatar",tipo:"perfil_titulo",slot:"profileTitle",valor:"Corte Fresco",puntos_precio:250,rareza:"comun",activo:true,stock:null},
  {id:"title_puerto_rasta",item_key:"title_puerto_rasta",icono:"⚓",nombre:"Título: Puerto Rasta",descripcion:"Título de perfil con aire marinero/barber.",categoria:"avatar",tipo:"perfil_titulo",slot:"profileTitle",valor:"Puerto Rasta",puntos_precio:450,rareza:"raro",activo:true,stock:null},
  {id:"title_barrio_vip",item_key:"title_barrio_vip",icono:"👑",nombre:"Título: Barrio VIP",descripcion:"Título premium para perfiles con flow.",categoria:"avatar",tipo:"perfil_titulo",slot:"profileTitle",valor:"Barrio VIP",puntos_precio:1200,rareza:"epico",activo:true,stock:null},
  {id:"title_capitan_barber",item_key:"title_capitan_barber",icono:"🏴‍☠️",nombre:"Título: Capitán Barber",descripcion:"Título legendario para perfiles veteranos.",categoria:"avatar",tipo:"perfil_titulo",slot:"profileTitle",valor:"Capitán Barber",puntos_precio:2600,rareza:"legendario",activo:true,stock:null},
  {id:"name_green",item_key:"name_green",icono:"🟢",nombre:"Nombre verde rasta",descripcion:"Color verde para tu nombre público.",categoria:"avatar",tipo:"perfil_color",slot:"nameColor",valor:"green",puntos_precio:420,rareza:"comun",activo:true,stock:null},
  {id:"name_gold",item_key:"name_gold",icono:"✨",nombre:"Nombre dorado",descripcion:"Color especial para destacar tu nombre en perfil y comunidad.",categoria:"avatar",tipo:"perfil_color",slot:"nameColor",valor:"gold",puntos_precio:850,rareza:"raro",activo:true,stock:null},
  {id:"profile_card_wood",item_key:"profile_card_wood",icono:"🪵",nombre:"Tarjeta Pergamino",descripcion:"Estilo visual de tarjeta de perfil tipo Travian.",categoria:"avatar",tipo:"perfil_card",slot:"profileCard",valor:"wood",puntos_precio:700,rareza:"raro",activo:true,stock:null},
  {id:"profile_card_night",item_key:"profile_card_night",icono:"🌙",nombre:"Tarjeta Muelle Nocturno",descripcion:"Marco oscuro/verde para tarjeta de perfil.",categoria:"avatar",tipo:"perfil_card",slot:"profileCard",valor:"nightGreen",puntos_precio:1300,rareza:"epico",activo:true,stock:null},
  {id:"sticker_scissors",item_key:"sticker_scissors",icono:"✂️",nombre:"Pegatina Tijeras",descripcion:"Pegatina coleccionable para futuras tarjetas de perfil.",categoria:"avatar",tipo:"perfil_sticker",slot:"sticker",valor:"scissors",puntos_precio:180,rareza:"comun",activo:true,stock:null},
  {id:"sticker_dread",item_key:"sticker_dread",icono:"🦁",nombre:"Pegatina Dread",descripcion:"Pegatina rasta para futuras tarjetas de perfil.",categoria:"avatar",tipo:"perfil_sticker",slot:"sticker",valor:"dread",puntos_precio:320,rareza:"raro",activo:true,stock:null}
].map(x => ({...x, origen:"fallback_personalizacion"}));
