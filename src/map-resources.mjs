// Published resource manifest from GeNeFRAG/ArmaReforger maps_core/all_arma_maps.json.
// These are remote CDN assets: presence in the catalogue does not guarantee availability.
export const MAP_RESOURCES = {
  "everon": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/everon_sat_z7_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/everon_height.json"
  },
  "arland": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/arland_sat_z6_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/arland_height.json"
  },
  "kolguev": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/kolguev_sat_z7_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/kolguev_height.json"
  },
  "anizay": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/anizay_sat_z7_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/anizay_height.json"
  },
  "badorb": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/badorb_sat_z6_full.png",
    "height": null
  },
  "belleau": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/belleau_sat_z7_full.png",
    "height": null
  },
  "fallujah": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/fallujah_sat_z6_full.png",
    "height": null
  },
  "gogland": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/gogland_sat_z7_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/gogland_height.json"
  },
  "khanh_trung": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/khanh_trung_sat_z6_full.png",
    "height": null
  },
  "kunar": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/kunar_sat_z5_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/kunar_height.json"
  },
  "myccano": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/myccano_sat_z7_full.png",
    "height": null
  },
  "nizla": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/nizla_sat_z7_full.png",
    "height": null
  },
  "novka": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/novka_sat_z5_full.png",
    "height": null
  },
  "rooikat": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/rooikat_sat_z6_full.png",
    "height": null
  },
  "rostov": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/rostov_sat_z7_full.png",
    "height": null
  },
  "ruha": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/ruha_sat_z7_full.png",
    "height": null
  },
  "saigon": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/saigon_sat_z7_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/saigon_height.json"
  },
  "seitenbuch": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/seitenbuch_sat_z6_full.png",
    "height": null
  },
  "serhiivka": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/serhiivka_sat_z7_full.png",
    "height": null
  },
  "takistan": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/takistan_sat_z7_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/takistan_height.json"
  },
  "udachne": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/udachne_sat_z7_full.png",
    "height": null
  },
  "zarichne": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/zarichne_sat_z6_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/zarichne_height.json"
  },
  "zimnitrita": {
    "image": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/zimnitrita_sat_z7_full.png",
    "height": "https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/zimnitrita_height.json"
  }
};
export const mapImageUrl = slug => MAP_RESOURCES[slug]?.image || null;
export const mapHeightUrl = slug => MAP_RESOURCES[slug]?.height || null;
