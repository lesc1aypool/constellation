# Similar-artist source comparison: ListenBrainz vs Last.fm

Generated 2026-11-20 by `pipeline/compare_sources.py`. Top 20 similar artists per source.

- **ListenBrainz:** labs `similar-artists` API (experimental), algorithm `session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30`. Score = raw co-listening count.
- **Last.fm:** `artist.getSimilar`, match = 0–1. Data from [Last.fm](https://www.last.fm).
- **Bold** = the artist appears in both lists. Overlap is matched by MBID, or by name when Last.fm gives no MBID.

## Summary

| Artist | Last.fm listeners | LB results | Last.fm results | Overlap | Last.fm results with MBID |
| --- | ---: | ---: | ---: | ---: | ---: |
| Metallica | 5,350,718 | 20 | 20 | 7 | 19/20 |
| Iron Maiden | 3,280,251 | 20 | 20 | 9 | 20/20 |
| Opeth | 1,219,615 | 20 | 20 | 6 | 19/20 |
| In Flames | 1,611,582 | 20 | 20 | 5 | 20/20 |
| Ghost | 1,742,365 | 20 | 20 | 6 | 20/20 |
| Mastodon | 1,300,995 | 20 | 20 | 4 | 20/20 |
| Gojira | 1,077,277 | 20 | 20 | 6 | 20/20 |
| Sleep | 475,384 | 20 | 20 | 9 | 20/20 |
| Wolves in the Throne Room | 209,761 | 20 | 20 | 6 | 19/20 |
| Khemmis | 80,974 | 20 | 20 | 4 | 20/20 |

Things to judge by eye: are the results metal at all? Are they the *right* neighbourhood (e.g. Khemmis → doom, not generic rock)? Does a source collapse into the same few huge bands?

## Metallica (US)

MBID [`65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab`](https://musicbrainz.org/artist/65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab) · 5,350,718 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | Nirvana | 8,788 | **Megadeth** | 1.00 |
| 2 | System of a Down | 7,783 | Slayer | 0.62 |
| 3 | Red Hot Chili Peppers | 7,752 | **Pantera** | 0.61 |
| 4 | **Iron Maiden** | 7,712 | Anthrax | 0.61 |
| 5 | **Guns N’ Roses** | 7,522 | **Iron Maiden** | 0.50 |
| 6 | **Black Sabbath** | 7,373 | Sepultura | 0.44 |
| 7 | Led Zeppelin | 7,120 | Exodus | 0.42 |
| 8 | **AC/DC** | 7,111 | **Ozzy Osbourne** | 0.39 |
| 9 | Queen | 6,783 | Motörhead | 0.39 |
| 10 | **Megadeth** | 6,764 | **Black Sabbath** | 0.39 |
| 11 | Pink Floyd | 6,599 | Testament | 0.38 |
| 12 | Foo Fighters | 6,440 | Slipknot | 0.37 |
| 13 | Linkin Park | 6,325 | **Guns N' Roses** ⚠︎ | 0.34 |
| 14 | Green Day | 6,300 | Kreator | 0.34 |
| 15 | Rage Against the Machine | 6,252 | **AC/DC** | 0.34 |
| 16 | Radiohead | 6,084 | Overkill | 0.32 |
| 17 | **Pantera** | 5,613 | Diamond Head | 0.31 |
| 18 | **Ozzy Osbourne** | 5,608 | Judas Priest | 0.31 |
| 19 | Muse | 5,559 | Mötley Crüe | 0.30 |
| 20 | The Offspring | 5,555 | Dio | 0.29 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## Iron Maiden (GB, English heavy metal band)

MBID [`ca891d65-d9b0-4258-89f7-e6ba29d83767`](https://musicbrainz.org/artist/ca891d65-d9b0-4258-89f7-e6ba29d83767) · 3,280,251 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | **Metallica** | 7,712 | Bruce Dickinson | 1.00 |
| 2 | **Black Sabbath** | 6,878 | **Judas Priest** | 0.65 |
| 3 | **Judas Priest** | 6,048 | Helloween | 0.57 |
| 4 | **Megadeth** | 5,624 | **Dio** | 0.52 |
| 5 | **AC/DC** | 5,187 | **Megadeth** | 0.50 |
| 6 | Guns N’ Roses | 5,143 | Saxon | 0.50 |
| 7 | **Ozzy Osbourne** | 5,121 | **Black Sabbath** | 0.44 |
| 8 | **Motörhead** | 5,085 | Anthrax | 0.43 |
| 9 | Led Zeppelin | 4,834 | **Motörhead** | 0.42 |
| 10 | Queen | 4,743 | Accept | 0.42 |
| 11 | System of a Down | 4,690 | **Metallica** | 0.38 |
| 12 | Nirvana | 4,432 | Blaze Bayley | 0.37 |
| 13 | **Slayer** | 4,350 | **Slayer** | 0.34 |
| 14 | Pantera | 4,237 | **Ozzy Osbourne** | 0.34 |
| 15 | Deep Purple | 4,236 | Manowar | 0.34 |
| 16 | Red Hot Chili Peppers | 4,139 | HammerFall | 0.32 |
| 17 | **Dio** | 4,085 | Rainbow | 0.32 |
| 18 | Pink Floyd | 4,070 | Savatage | 0.30 |
| 19 | Van Halen | 3,998 | Queensrÿche | 0.30 |
| 20 | Scorpions | 3,739 | **AC/DC** | 0.30 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## Opeth (SE, Swedish progressive metal/rock)

MBID [`c14b4180-dc87-481e-b17a-64e4150f90f6`](https://musicbrainz.org/artist/c14b4180-dc87-481e-b17a-64e4150f90f6) · 1,219,615 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | Metallica | 2,642 | **Katatonia** | 1.00 |
| 2 | **Porcupine Tree** | 2,568 | **Porcupine Tree** | 0.96 |
| 3 | **Dream Theater** | 2,509 | **Gojira** | 0.89 |
| 4 | Tool | 2,278 | Edge of Sanity | 0.87 |
| 5 | **Mastodon** | 2,212 | **Dream Theater** | 0.82 |
| 6 | **Katatonia** | 2,205 | Storm Corrosion | 0.79 |
| 7 | Iron Maiden | 2,150 | Agalloch | 0.78 |
| 8 | Pink Floyd | 2,140 | Ne Obliviscaris | 0.77 |
| 9 | **Gojira** | 2,139 | Bloodbath | 0.76 |
| 10 | In Flames | 1,976 | Pain of Salvation | 0.71 |
| 11 | System of a Down | 1,957 | Soen | 0.70 |
| 12 | Megadeth | 1,919 | Steven Wilson | 0.66 |
| 13 | Black Sabbath | 1,883 | Wilderun | 0.62 |
| 14 | Anathema | 1,882 | Blood Incantation | 0.61 |
| 15 | Nine Inch Nails | 1,751 | **Mastodon** | 0.61 |
| 16 | Pantera | 1,703 | Leprous | 0.61 |
| 17 | Meshuggah | 1,679 | Riverside | 0.60 |
| 18 | Slayer | 1,618 | Haken | 0.60 |
| 19 | **Death** | 1,606 | **Death** | 0.59 |
| 20 | Amon Amarth | 1,596 | Caligula's Horse ⚠︎ | 0.58 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## In Flames (SE)

MBID [`31745282-b1ea-4d62-939f-226b14d68e7c`](https://musicbrainz.org/artist/31745282-b1ea-4d62-939f-226b14d68e7c) · 1,611,582 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | Metallica | 3,316 | **Dark Tranquillity** | 1.00 |
| 2 | System of a Down | 3,126 | **Soilwork** | 0.98 |
| 3 | **Children of Bodom** | 2,881 | The Halo Effect | 0.84 |
| 4 | Slipknot | 2,871 | Insomnium | 0.72 |
| 5 | Iron Maiden | 2,728 | **Arch Enemy** | 0.63 |
| 6 | **Amon Amarth** | 2,657 | **Children of Bodom** | 0.62 |
| 7 | **Dark Tranquillity** | 2,651 | Scar Symmetry | 0.57 |
| 8 | Disturbed | 2,649 | At the Gates | 0.57 |
| 9 | **Arch Enemy** | 2,637 | Amorphis | 0.54 |
| 10 | Korn | 2,534 | Kalmah | 0.53 |
| 11 | Rammstein | 2,512 | **Amon Amarth** | 0.52 |
| 12 | **Soilwork** | 2,389 | Omnium Gatherum | 0.50 |
| 13 | Linkin Park | 2,367 | Mors Principium Est | 0.50 |
| 14 | Killswitch Engage | 2,360 | Heaven Shall Burn | 0.49 |
| 15 | Megadeth | 2,347 | Orbit Culture | 0.46 |
| 16 | Trivium | 2,248 | Hypocrisy | 0.45 |
| 17 | Slayer | 2,232 | Before the Dawn | 0.43 |
| 18 | Nightwish | 2,214 | Disarmonia Mundi | 0.43 |
| 19 | Lamb of God | 2,164 | Sonic Syndicate | 0.43 |
| 20 | Pantera | 2,158 | Nightrage | 0.42 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## Ghost (SE, Swedish metal band)

MBID [`2bcf2e02-5bc3-4c76-bf76-41126cb11444`](https://musicbrainz.org/artist/2bcf2e02-5bc3-4c76-bf76-41126cb11444) · 1,742,365 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | **Metallica** | 2,060 | Dogma | 1.00 |
| 2 | **Iron Maiden** | 1,654 | Volbeat | 0.59 |
| 3 | Rammstein | 1,493 | Unto Others | 0.39 |
| 4 | **Megadeth** | 1,488 | **Iron Maiden** | 0.38 |
| 5 | Slipknot | 1,481 | **Ozzy Osbourne** | 0.33 |
| 6 | System of a Down | 1,406 | Powerwolf | 0.32 |
| 7 | **Black Sabbath** | 1,388 | **Black Sabbath** | 0.31 |
| 8 | Mastodon | 1,384 | Lucifer | 0.31 |
| 9 | Gojira | 1,368 | Dio | 0.31 |
| 10 | **Judas Priest** | 1,320 | Green Lung | 0.31 |
| 11 | Slayer | 1,262 | **Judas Priest** | 0.31 |
| 12 | In Flames | 1,195 | Beast in Black | 0.30 |
| 13 | Korn | 1,171 | **Metallica** | 0.29 |
| 14 | Disturbed | 1,170 | Avenged Sevenfold | 0.29 |
| 15 | Muse | 1,093 | Heaven & Hell | 0.29 |
| 16 | Amon Amarth | 1,087 | Bruce Dickinson | 0.29 |
| 17 | Five Finger Death Punch | 1,071 | Year of the Goat | 0.28 |
| 18 | **Ozzy Osbourne** | 1,060 | Lordi | 0.27 |
| 19 | Pantera | 1,033 | **Megadeth** | 0.26 |
| 20 | Opeth | 1,018 | W.A.S.P. | 0.25 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## Mastodon (US, American heavy metal band)

MBID [`bc5e2ad6-0a4a-4d90-b911-e9a7e6861727`](https://musicbrainz.org/artist/bc5e2ad6-0a4a-4d90-b911-e9a7e6861727) · 1,300,995 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | Metallica | 2,872 | Baroness | 1.00 |
| 2 | **Gojira** | 2,502 | **Gojira** | 0.80 |
| 3 | System of a Down | 2,308 | The Ocean | 0.72 |
| 4 | Megadeth | 2,218 | **Opeth** | 0.61 |
| 5 | Deftones | 2,217 | High on Fire | 0.58 |
| 6 | **Opeth** | 2,212 | Anciients | 0.57 |
| 7 | Pantera | 2,174 | Between the Buried and Me | 0.55 |
| 8 | Iron Maiden | 2,128 | Neurosis | 0.50 |
| 9 | Queens of the Stone Age | 2,121 | **Meshuggah** | 0.50 |
| 10 | Slayer | 2,116 | Intronaut | 0.49 |
| 11 | **Tool** | 2,056 | Cult of Luna | 0.48 |
| 12 | Slipknot | 2,056 | Haken | 0.48 |
| 13 | Black Sabbath | 1,991 | Isis | 0.47 |
| 14 | Lamb of God | 1,973 | Kylesa | 0.46 |
| 15 | **Meshuggah** | 1,856 | Dvne | 0.42 |
| 16 | Nine Inch Nails | 1,847 | Black Tusk | 0.40 |
| 17 | A Perfect Circle | 1,819 | **Tool** | 0.38 |
| 18 | In Flames | 1,817 | Protest the Hero | 0.38 |
| 19 | Alice in Chains | 1,789 | Khemmis | 0.37 |
| 20 | Machine Head | 1,707 | Devin Townsend | 0.37 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## Gojira (FR, French metal)

MBID [`1c5efd53-d6b6-4d63-9d22-a15025cf5f07`](https://musicbrainz.org/artist/1c5efd53-d6b6-4d63-9d22-a15025cf5f07) · 1,077,277 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | **Mastodon** | 2,502 | **Opeth** | 1.00 |
| 2 | **Opeth** | 2,139 | **Meshuggah** | 0.97 |
| 3 | Metallica | 2,037 | **Mastodon** | 0.91 |
| 4 | **Lamb of God** | 2,016 | **Lamb of God** | 0.72 |
| 5 | **Meshuggah** | 2,013 | **Tool** | 0.68 |
| 6 | Slayer | 1,798 | Death | 0.62 |
| 7 | Slipknot | 1,747 | Rivers of Nihil | 0.49 |
| 8 | System of a Down | 1,746 | Animals as Leaders | 0.47 |
| 9 | In Flames | 1,744 | Black Crown Initiate | 0.45 |
| 10 | Amon Amarth | 1,701 | Blood Incantation | 0.44 |
| 11 | Megadeth | 1,664 | **Sepultura** | 0.44 |
| 12 | Pantera | 1,642 | Jinjer | 0.44 |
| 13 | **Tool** | 1,543 | Strapping Young Lad | 0.38 |
| 14 | Machine Head | 1,524 | The Ocean | 0.35 |
| 15 | Deftones | 1,501 | Persefone | 0.35 |
| 16 | Iron Maiden | 1,487 | Dream Theater | 0.35 |
| 17 | Korn | 1,448 | Leprous | 0.35 |
| 18 | **Sepultura** | 1,372 | Beyond Creation | 0.34 |
| 19 | Ghost | 1,368 | Edge of Sanity | 0.34 |
| 20 | Trivium | 1,334 | Baroness | 0.33 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## Sleep (US, American stoner/doom metal band)

MBID [`6fc69ec6-3e59-4ff7-849d-b5da932abe4d`](https://musicbrainz.org/artist/6fc69ec6-3e59-4ff7-849d-b5da932abe4d) · 475,384 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | **Electric Wizard** | 1,017 | **Electric Wizard** | 1.00 |
| 2 | **Kyuss** | 864 | **Bongzilla** | 0.81 |
| 3 | **Melvins** | 823 | **Weedeater** | 0.81 |
| 4 | **High on Fire** | 709 | **Om** | 0.78 |
| 5 | **Om** | 569 | **High on Fire** | 0.69 |
| 6 | The Sword | 562 | **Acid King** | 0.68 |
| 7 | Mastodon | 558 | Church of Misery | 0.59 |
| 8 | Queens of the Stone Age | 554 | Belzebong | 0.57 |
| 9 | Fu Manchu | 465 | Monolord | 0.57 |
| 10 | Red Fang | 456 | Windhand | 0.55 |
| 11 | **Acid King** | 447 | Bongripper | 0.54 |
| 12 | Earth | 442 | **Kyuss** | 0.53 |
| 13 | Uncle Acid & The Deadbeats | 433 | **Eyehategod** | 0.53 |
| 14 | Orange Goblin | 414 | Saint Vitus | 0.52 |
| 15 | **Bongzilla** | 400 | Dopelord | 0.50 |
| 16 | Baroness | 400 | Mephistofeles | 0.49 |
| 17 | **Weedeater** | 385 | YOB | 0.47 |
| 18 | **Eyehategod** | 366 | Conan | 0.46 |
| 19 | Witchcraft | 359 | **Melvins** | 0.45 |
| 20 | Ufomammut | 358 | Cough | 0.44 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## Wolves in the Throne Room (US, US black metal)

MBID [`e9452446-7702-4853-96ce-5dfe6748d3fb`](https://musicbrainz.org/artist/e9452446-7702-4853-96ce-5dfe6748d3fb) · 209,761 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | **Agalloch** | 487 | **Panopticon** | 1.00 |
| 2 | Alcest | 459 | **Drudkh** | 0.91 |
| 3 | Ulver | 356 | **Agalloch** | 0.82 |
| 4 | **Enslaved** | 353 | Paysage d'Hiver ⚠︎ | 0.81 |
| 5 | **Blut aus Nord** | 321 | Wayfarer | 0.79 |
| 6 | Burzum | 312 | Mare Cognitum | 0.74 |
| 7 | Deafheaven | 307 | Wiegedood | 0.73 |
| 8 | Summoning | 289 | Fluisteraars | 0.71 |
| 9 | Darkthrone | 257 | Falls of Rauros | 0.71 |
| 10 | Emperor | 253 | The Ruins of Beverast | 0.71 |
| 11 | **Panopticon** | 246 | Fen | 0.70 |
| 12 | Lantlôs | 232 | **Enslaved** | 0.69 |
| 13 | Immortal | 222 | Spectral Wound | 0.69 |
| 14 | **Drudkh** | 218 | Winterfylleth | 0.68 |
| 15 | **Altar of Plagues** | 216 | Ash Borer | 0.68 |
| 16 | Primordial | 213 | Ultha | 0.68 |
| 17 | Watain | 211 | **Altar of Plagues** | 0.68 |
| 18 | Satyricon | 206 | **Blut aus Nord** | 0.67 |
| 19 | Mayhem | 204 | Darkspace | 0.65 |
| 20 | Anaal Nathrakh | 201 | Dödsrit | 0.63 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).

## Khemmis (doom metal band from Denver, Colorado)

MBID [`425780ef-6214-41cb-a867-4a3aafd4c6e3`](https://musicbrainz.org/artist/425780ef-6214-41cb-a867-4a3aafd4c6e3) · 80,974 Last.fm listeners · Last.fm looked up by mbid

| # | ListenBrainz | score | Last.fm | match |
| ---: | --- | ---: | --- | ---: |
| 1 | **Pallbearer** | 153 | Spirit Adrift | 1.00 |
| 2 | Mastodon | 153 | **Monolord** | 0.87 |
| 3 | Windhand | 111 | **Pallbearer** | 0.81 |
| 4 | High on Fire | 99 | Fires in the Distance | 0.68 |
| 5 | Metallica | 83 | Green Lung | 0.60 |
| 6 | Opeth | 81 | Crypt Sermon | 0.59 |
| 7 | Zeal & Ardor | 81 | **Elder** | 0.57 |
| 8 | **Monolord** | 80 | Godthrymm | 0.54 |
| 9 | **Elder** | 79 | Warning | 0.52 |
| 10 | **YOB** | 79 | REZN | 0.50 |
| 11 | Baroness | 77 | **YOB** | 0.47 |
| 12 | Tribulation | 75 | Restless Spirit | 0.46 |
| 13 | Katatonia | 75 | Fvneral Fvkk | 0.45 |
| 14 | Iron Maiden | 74 | Sumerlands | 0.44 |
| 15 | Black Sabbath | 72 | Mother of Graves | 0.44 |
| 16 | Inter Arma | 70 | Witch Ripper | 0.43 |
| 17 | Judas Priest | 67 | Green Carnation | 0.41 |
| 18 | Electric Wizard | 66 | Smoulder | 0.40 |
| 19 | Ihsahn | 66 | Conan | 0.39 |
| 20 | Candlemass | 65 | Messa | 0.37 |

⚠︎ = Last.fm gave no MBID for this artist (would need a MusicBrainz lookup).
