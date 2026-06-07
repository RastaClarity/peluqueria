// Rasta Cuts 2.9.3b
// Datos de música y sonidos separados de App.jsx para evitar que el archivo principal crezca sin control.

export const BACKGROUND_PLAYLIST=[
  {name:"Glass Lounge Loop",mood:"lounge",gain:1.00,srcs:["/audio/Glass%20Lounge%20Loop.mp3","/audio/Glass Lounge Loop.mp3"]},
  {name:"Quiet Rhodes Loop",mood:"chill",gain:1.16,srcs:["/audio/Quiet%20Rhodes%20Loop.mp3","/audio/Quiet Rhodes Loop.mp3"]},
  {name:"Velvet Reward Room",mood:"reward",gain:0.92,srcs:["/audio/Velvet%20Reward%20Room.mp3","/audio/Velvet Reward Room.mp3"]},
  {name:"Velvet Menu Glow",mood:"menu",gain:0.94,srcs:["/audio/Velvet%20Menu%20Glow.mp3","/audio/Velvet Menu Glow.mp3"]},
  {name:"Velvet Reward Shop",mood:"shop",gain:0.90,srcs:["/audio/Velvet%20Reward%20Shop.mp3","/audio/Velvet Reward Shop.mp3"]},
  {name:"Drift Through Linen",mood:"ambient",gain:1.12,srcs:["/audio/Drift%20Through%20Linen.mp3","/audio/Drift Through Linen.mp3"]},
  {name:"Velvet Menu Drift",mood:"menu",gain:1.04,srcs:["/audio/Velvet%20Menu%20Drift.mp3","/audio/Velvet Menu Drift.mp3"]},
  {name:"Velvet Tab Loop",mood:"tab",gain:1.08,srcs:["/audio/Velvet%20Tab%20Loop.mp3","/audio/Velvet Tab Loop.mp3"]},
  {name:"Barbershop Arcade Dub",mood:"backup",gain:0.95,srcs:["/audio/barbershop-arcade-dub.mp3","/audio/barbershop-arcade-dub(1).mp3"]},
  {name:"Vinyl Arcade Skank",mood:"backup",gain:0.95,srcs:["/audio/Vinyl%20Arcade%20Skank.mp3","/audio/vinyl-arcade-skank.mp3"]},
  {name:"Neon Barbertron",mood:"backup",gain:0.95,srcs:["/audio/Neon%20Barbertron.mp3","/audio/neon-barbertron.mp3"]}
];

export const PENTA=[261.63,293.66,329.63,392.0,440.0,523.25,587.33,659.25];

export const NOTE_FREQ={
  C2:65.41,Cs2:69.30,Db2:69.30,D2:73.42,Ds2:77.78,Eb2:77.78,E2:82.41,F2:87.31,Fs2:92.50,Gb2:92.50,G2:98,Ab2:103.83,Gs2:103.83,A2:110,As2:116.54,Bb2:116.54,B2:123.47,
  C3:130.81,Cs3:138.59,Db3:138.59,D3:146.83,Ds3:155.56,Eb3:155.56,E3:164.81,F3:174.61,Fs3:185.00,Gb3:185.00,G3:196,Ab3:207.65,Gs3:207.65,A3:220,As3:233.08,Bb3:233.08,B3:246.94,
  C4:261.63,Cs4:277.18,Db4:277.18,D4:293.66,Ds4:311.13,Eb4:311.13,E4:329.63,F4:349.23,Fs4:369.99,Gb4:369.99,G4:392,Ab4:415.30,Gs4:415.30,A4:440,As4:466.16,Bb4:466.16,B4:493.88,
  C5:523.25,Cs5:554.37,Db5:554.37,D5:587.33,Ds5:622.25,Eb5:622.25,E5:659.25,F5:698.46,Fs5:739.99,Gb5:739.99,G5:783.99,Ab5:830.61,Gs5:830.61,A5:880,As5:932.33,Bb5:932.33,B5:987.77,
  C6:1046.5,Cs6:1108.73,Db6:1108.73,D6:1174.66,Ds6:1244.51,Eb6:1244.51,E6:1318.51,F6:1396.91,Fs6:1479.98,Gb6:1479.98,G6:1567.98,Ab6:1661.22,Gs6:1661.22,A6:1760,As6:1864.66,Bb6:1864.66,B6:1975.53
};

export const REGGAE_LOFI_TRACKS=[
  {
    name:"Brisa Dub de Pueblo",tickMs:430,length:704,accent:"pan",
    bass:["A2",null,"A2","C3","E2",null,"G2","E2","F2",null,"F2","A2","G2",null,"E2","G2"],
    chords:[["A3","C4","E4"],["G3","B3","D4"],["F3","A3","C4"],["E3","G3","B3"]],
    melody:["E5",null,"G5","A5","C6",null,"B5","A5","G5",null,"E5","D5","E5",null,"G5",null,"A5",null,"C6","E6","D6",null,"C6","A5","G5",null,"A5","G5","E5",null,"D5",null],
    counter:["A4",null,"C5",null,"E5",null,"C5",null,"G4",null,"B4",null,"D5",null,"B4",null],
    groove:{kick:[0,8],snare:[4,12],hat:[2,6,10,14],bass:[0,3,8,11,14],skank:[5,13],ghost:[7,15],melody:[1,5,9,13],counter:[6,10,14],padEvery:32,arp:30}
  },
  {
    name:"Skank de Mercado",tickMs:385,length:784,accent:"piano",
    bass:["D2",null,"D2","F2","A2",null,"C3","A2","Bb2",null,"Bb2","D3","C3",null,"A2","C3"],
    chords:[["D3","F3","A3"],["C3","E3","G3"],["Bb2","D3","F3"],["A2","C3","E3"]],
    melody:["A4","D5",null,"F5","E5",null,"D5",null,"C5","E5",null,"G5","F5",null,"E5",null,"D5",null,"F5","A5",null,"G5","E5",null,"F5",null,"E5","D5",null,"C5",null,null],
    counter:["D4",null,"F4",null,"A4",null,"F4",null,"C4",null,"E4",null,"G4",null,"E4",null],
    groove:{kick:[0,6,10],snare:[4,12],rim:[15],hat:[2,5,8,11,14],bass:[0,2,6,8,10,13],skank:[3,7,11,15],ghost:[5,13],melody:[0,3,6,10,12],counter:[5,9,14],padEvery:64,arp:31}
  },
  {
    name:"Noche Lofi en Tagor",tickMs:470,length:640,accent:"violin",
    bass:["G2",null,null,"Bb2","D2",null,"F2",null,"Eb2",null,null,"G2","F2",null,"D2",null],
    chords:[["G3","Bb3","D4"],["F3","A3","C4"],["Eb3","G3","Bb3"],["D3","F3","A3"]],
    melody:["D5",null,null,"F5","G5",null,"Bb5",null,"A5",null,"G5","F5",null,"D5",null,null,"C5",null,"D5","F5",null,"G5",null,"Bb5","D6",null,"C6","Bb5",null,"G5",null,null],
    counter:["G4",null,null,"Bb4",null,"D5",null,null,"F4",null,"A4",null,"C5",null,null,null],
    groove:{kick:[0,9],snare:[4,12],hat:[3,7,11,15],bass:[0,4,9,12],skank:[6,14],ghost:[10],melody:[3,7,11,15],counter:[5,13],padEvery:16,arp:46}
  },
  {
    name:"Costa One Drop",tickMs:410,length:736,accent:"pan",
    bass:["C2",null,"C3",null,"G2",null,"Bb2","G2","F2",null,"F3",null,"G2",null,"Bb2","G2"],
    chords:[["C3","E3","G3"],["Bb2","D3","F3"],["F3","A3","C4"],["G3","B3","D4"]],
    melody:["G4","C5",null,"E5",null,"G5","E5",null,"Bb4","D5",null,"F5",null,"D5",null,null,"A4","C5",null,"F5","E5",null,"C5",null,"D5",null,"G5",null,"F5","D5",null,null],
    counter:["C4",null,"E4",null,"G4",null,"E4",null,"F4",null,"A4",null,"C5",null,"A4",null],
    groove:{kick:[0],snare:[4,12],rim:[8],hat:[2,6,10,14],bass:[0,1,7,8,9,15],skank:[2,6,10,14],ghost:[3,11],melody:[0,3,5,8,11,14],counter:[7,15],padEvery:48,arp:63}
  },
  {
    name:"Ruta Rasta RPG",tickMs:360,length:848,accent:"piano",
    bass:["E2",null,"E2","G2","B2",null,"D3","B2","C3",null,"C3","E3","D3",null,"B2","D3"],
    chords:[["E3","G3","B3"],["D3","Fs3","A3"],["C3","E3","G3"],["B2","D3","Fs3"]],
    melody:["B4","E5","G5","B5",null,"A5","G5","E5","D5",null,"E5","G5","A5",null,"B5",null,"C6","B5","A5","G5",null,"E5",null,"D5","E5","G5",null,"A5","G5","E5",null,null],
    counter:["E4",null,"G4",null,"B4",null,"G4",null,"D4",null,"Fs4",null,"A4",null,"Fs4",null],
    groove:{kick:[0,4,8,12],snare:[6,14],hat:[1,3,5,7,9,11,13,15],bass:[0,2,4,7,8,10,12,15],skank:[5,9,13],ghost:[3,11,15],melody:[0,2,4,6,8,10,12,14],counter:[7,15],padEvery:64,arp:30}
  },
  {
    name:"Dub Espacial de Taller",tickMs:520,length:592,accent:"violin",
    bass:["F2",null,null,null,"F2",null,"A2",null,"C3",null,null,"A2","Bb2",null,"C3",null],
    chords:[["F3","A3","C4"],["C3","E3","G3"],["Bb2","D3","F3"],["C3","E3","G3"]],
    melody:["C5",null,null,"F5",null,"A5",null,null,"G5",null,"F5",null,"E5",null,null,null,"D5",null,"F5",null,"G5",null,"A5",null,"C6",null,"A5","G5",null,"F5",null,null],
    counter:["F4",null,null,null,"A4",null,null,null,"C5",null,null,null,"A4",null,null,null],
    groove:{kick:[0,10],snare:[4,12],hat:[6,14],bass:[0,4,10,12],skank:[7,15],ghost:[3,11],melody:[3,5,9,13],counter:[8],padEvery:16,arp:62}
  },
  {
    name:"Tauste Sunshine Ska",tickMs:330,length:912,accent:"pan",
    bass:["A2","C3","E3",null,"G2","E2","C3",null,"F2","A2","C3",null,"E2","G2","B2",null],
    chords:[["A3","C4","E4"],["G3","B3","D4"],["F3","A3","C4"],["E3","G3","B3"]],
    melody:["A5",null,"C6","E6","D6",null,"C6","A5","G5",null,"A5","C6","B5",null,"A5",null,"E5","G5","A5","C6",null,"B5","G5",null,"A5",null,"E5",null,"G5","A5",null,null],
    counter:["A4","C5",null,"E5",null,"C5",null,"A4","G4","B4",null,"D5",null,"B4",null,"G4"],
    groove:{kick:[0,4,8,12],snare:[2,6,10,14],hat:[1,3,5,7,9,11,13,15],bass:[0,1,4,5,8,9,12,13],skank:[1,3,5,7,9,11,13,15],ghost:[],melody:[0,2,4,6,8,10,12,14],counter:[3,7,11,15],padEvery:96,arp:47}
  },
  {
    name:"Meditación con Dreadlocks",tickMs:560,length:544,accent:"violin",
    bass:["D2",null,null,null,"A2",null,null,null,"Bb2",null,null,null,"F2",null,"A2",null],
    chords:[["D3","F3","A3"],["A2","C3","E3"],["Bb2","D3","F3"],["F3","A3","C4"]],
    melody:["A4",null,null,null,"D5",null,"F5",null,"E5",null,null,"D5",null,"C5",null,null,"Bb4",null,"D5",null,"F5",null,null,"A5",null,"G5",null,"F5",null,null,null,null],
    counter:["D4",null,null,null,"F4",null,null,null,"A4",null,null,null,"F4",null,null,null],
    groove:{kick:[0],snare:[8],hat:[4,12],bass:[0,8,12],skank:[6,14],ghost:[],melody:[4,7,11,14],counter:[10],padEvery:16,arp:126}
  },
  {
    name:"Barrio Old School",tickMs:395,length:768,accent:"piano",
    bass:["B2",null,"B2","D3","Fs2",null,"A2","Fs2","G2",null,"G2","B2","A2",null,"Fs2","A2"],
    chords:[["B2","D3","Fs3"],["A2","Cs3","E3"],["G2","B2","D3"],["Fs2","A2","Cs3"]],
    melody:["Fs4",null,"B4","D5",null,"E5","D5","B4","A4",null,"Cs5","E5",null,"D5","Cs5",null,"B4","D5","Fs5",null,"E5","D5",null,"B4","A4",null,"B4","D5","Cs5",null,"A4",null],
    counter:["B3",null,"D4",null,"Fs4",null,"D4",null,"A3",null,"Cs4",null,"E4",null,"Cs4",null],
    groove:{kick:[0,7,8],snare:[4,12],rim:[10,15],hat:[2,5,6,9,11,14],bass:[0,3,7,8,11,15],skank:[5,13],ghost:[2,10,14],melody:[1,4,7,9,12,15],counter:[6,10,14],padEvery:64,arp:31}
  },
  {
    name:"Isla de Vinilo",tickMs:445,length:688,accent:"pan",
    bass:["C2",null,"Eb2",null,"G2",null,"Bb2",null,"Ab2",null,"C3",null,"Bb2",null,"G2",null],
    chords:[["C3","Eb3","G3"],["Bb2","D3","F3"],["Ab2","C3","Eb3"],["G2","Bb2","D3"]],
    melody:["G4",null,"C5",null,"Eb5","G5",null,"Bb5","Ab5",null,"G5","Eb5",null,"C5",null,null,"Bb4",null,"D5","F5",null,"G5",null,"F5","Eb5",null,"C5",null,"Bb4",null,"G4",null],
    counter:["C4",null,null,"Eb4",null,"G4",null,null,"Ab4",null,null,"C5",null,"Bb4",null,null],
    groove:{kick:[0,8,11],snare:[4,12],hat:[2,6,9,14],bass:[0,2,4,8,11,12,14],skank:[3,7,13],ghost:[5,15],melody:[2,5,8,10,13],counter:[7,15],padEvery:32,arp:30}
  }
];

export const GAME_MUSIC={
  sopa:{notes:[392,440,494,587,659],tempo:820,wave:"triangle",bass:.5},
  memoria:{notes:[330,392,440,494,523],tempo:760,wave:"sine",bass:.5},
  trivia:{notes:[349,392,440,523,587],tempo:720,wave:"triangle",bass:.5},
  runner:{notes:[330,392,494,587,659],tempo:520,wave:"square",bass:.45},
  jump:{notes:[392,494,587,659,784],tempo:560,wave:"triangle",bass:.5},
  stitch:{notes:[349,440,523,659,784],tempo:610,wave:"triangle",bass:.5},
  gacha:{notes:[196,247,294,330,392,494],tempo:430,wave:"square",bass:.42},
};

