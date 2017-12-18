
class Playlist extends Array {
  constructor(songs) {
    super();
    songs.forEach(s => this.push(s));
  }
  toString() {
    return `Playlist ${JSON.stringify(this, null, 2)}`;
  }
  addToRadio(radio) {
    this.forEach(s => radio.addUrl(s));
  }
}

module.exports = {
  edm: new Playlist([
    'https://www.youtube.com/watch?v=mb-XCaA2HZs', // Rick and Morty - Evil Morty Theme Song (Trap Remix)
    'https://www.youtube.com/watch?v=GzDHML3Szv4', // L.A.O.S. - Hush Now (501 Remix)
    'https://www.youtube.com/watch?v=Gn52p1i0QQc', // StrachAttack - Look at Me! (ft. Mr. Meeseeks)
    'https://www.youtube.com/watch?v=nEt1bKGlCpM', // Virtual Riot - Idols (EDM Mashup)
    'https://www.youtube.com/watch?v=e88kbTGxEOg', // BTS (방탄소년단) – 'MIC Drop' (Steve Aoki Remix)
  ]),
};
