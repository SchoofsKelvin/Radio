
class Playlist {
  constructor(songs) {
    this.songs = songs;
  }
  toString() {
    return `Playlist [\n${this.songs.map(([url, title]) => `\t${url} - ${title}`).join('\n')}\n]`;
  }
  addToRadio(radio) {
    this.songs.forEach(([url, title]) => radio.addUrl(url, null, true, title));
  }
  addEntryToRadio(radio, num) {
    const [url, title] = this.songs[num];
    radio.addUrl(url, null, true, title);
  }
}

module.exports = {
  edm: new Playlist([
    ['https://www.youtube.com/watch?v=mb-XCaA2HZs', 'Rick and Morty - Evil Morty Theme Song (Trap Remix)'],
    ['https://www.youtube.com/watch?v=ksdAs4LBRq8', 'Rita Ora - Anywhere'],
    ['https://www.youtube.com/watch?v=GzDHML3Szv4', 'L.A.O.S. - Hush Now (501 Remix)'],
    ['https://www.youtube.com/watch?v=ipVjRIQQBic', 'heiakim Music - Counting!! (ft. Google Translate)'],
    ['https://www.youtube.com/watch?v=D-MORJmvvQw', 'Jingle Bell Rock Remix (A Trappy Christmas)'],
    ['https://www.youtube.com/watch?v=B6hAGk6s20E', 'Daft Punk vs. Red Hot Chili Peppers - Lose Yourself to Californication (Mashup)'],
    ['https://www.youtube.com/watch?v=Gn52p1i0QQc', 'StrachAttack - Look at Me! (ft. Mr. Meeseeks)'],
    ['https://www.youtube.com/watch?v=OzA-8okwuB8', 'heiakim Music - LAPPU TOPU COOLAH (ft. Google Translate)'],
    ['https://www.youtube.com/watch?v=nEt1bKGlCpM', 'Virtual Riot - Idols (EDM Mashup)'],
    ['https://www.youtube.com/watch?v=lKMqwRv3plI', 'Epic Sax Guy (Remix)'],
    ['https://www.youtube.com/watch?v=e88kbTGxEOg', 'BTS (방탄소년단) – MIC Drop (Steve Aoki Remix)'],
  ]),
};
