# Mappa dei Suoni

Piccola applicazione frontend per costruire una mappa sonora o audiovisiva a partire da:

- punti inseriti a mano sulla mappa
- file `CSV`
- file `GeoJSON`
- audio o video locali
- link video di YouTube

## Avvio

Apri [index.html](/Users/giovannipietrovitali/Documents/New project/index.html) in un browser moderno.

Per un uso più stabile conviene servirlo da una piccola cartella locale con un server statico, ma per molte situazioni va bene anche l'apertura diretta del file.

Se vuoi che i video YouTube si aprano direttamente dentro i popup, usa [start-local-server.command](/Users/giovannipietrovitali/Documents/New project/start-local-server.command) invece di aprire il file con doppio clic.

## Flusso consigliato

1. Carica eventuali audio o video locali.
2. Importa un `CSV` o un `GeoJSON`, oppure clicca sulla mappa per aggiungere punti a mano.
3. Per ogni punto puoi associare:
   - un file locale tramite `mediaName`
   - un URL audio/video tramite `mediaUrl` e `mediaType`
   - un video YouTube tramite `youtubeUrl`
4. Quando la mappa è pronta clicca `Scarica HTML finale`.

## CSV esempio

```csv
title,description,lat,lng,mediaName,youtubeUrl
Mercato,"Voci, passi e rumore delle bancarelle",45.4642,9.19,mercato.mp3,
Parco,"Suoni del vento e degli uccelli",45.472,9.18,parco.wav,
Piazza,"Osservare il rapporto tra suono e movimento",41.9028,12.4964,,https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## CSV stile Kepler

Sono supportati anche campi come questi:

```csv
id,nome,citta,point_latitude,point_longitude,descrizione,video
1,Colosseo,Roma,41.8902,12.4922,Monumento storico,https://www.youtube.com/watch?v=2IjVfTWuauo
```

In questo caso:

- `nome` viene letto come titolo
- `descrizione` viene letta come testo principale
- `point_latitude` e `point_longitude` vengono letti come coordinate
- `video` viene letto come link YouTube

## GeoJSON esempio

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "title": "Stazione",
        "description": "Annunci, treni e flussi di persone",
        "mediaName": "stazione.mp3"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [12.4964, 41.9028]
      }
    }
  ]
}
```

## Note

- Il file HTML esportato è pensato per la sola visualizzazione finale.
- L'HTML finale include i dati della mappa e gli eventuali media locali convertiti in formato incorporato.
- La cartografia usa Leaflet e le mappe base OpenStreetMap tramite CDN online.
