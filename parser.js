const axios = require("axios");
const fs = require("fs");

for (let i = 1; i < 6; i++) {
  axios
    .get(`https://api.punkapi.com/v2/beers?page=${i}&per_page=80`)
    .then((response) => {
      parseToSQL(response.data);
    })
    .catch((err) => {
      console.log(err);
    });
}

const parseToSQL = (data) => {
  let insert_beer_query = [];
  for (beer of data) {
    const date_fields = beer.first_brewed.split("/");
    const first_brewed = date_fields.length > 1 ? `${date_fields[1]}-${date_fields[0]}-01` : `${date_fields[0]}-01-01`;

    const abv = beer.abv ? `'${beer.abv}'` : null;
    const ibu = beer.ibu ? `'${beer.ibu}'` : null;
    const target_fg = beer.target_fg ? `'${beer.target_fg}'` : null;
    const target_og = beer.target_og ? `'${beer.target_og}'` : null;
    const ebc = beer.ebc ? `'${beer.ebc}'` : null;
    const srm = beer.srm ? `'${beer.srm}'` : null;
    const ph = beer.ph ? `'${beer.ph}'` : null;
    const attenuation_level = beer.attenuation_level ? `'${beer.attenuation_level}'` : null;
    const image_url = beer.image_url ? `'${beer.image_url}'` : null;
    const beer_characteristics_query = `INSERT INTO beer_characteristics VALUES(default, ${abv}, ${ibu}, ${target_fg}, ${target_og}, ${ebc}, ${srm}, ${ph}, ${attenuation_level});`;
    const beer_volume_query = `INSERT INTO amount VALUES(default, '${beer.volume.value}', '${beer.volume.unit}');`;
    const beer_boil_volume_query = `INSERT INTO amount VALUES(default, '${beer.boil_volume.value}', '${beer.boil_volume.unit}');`;
    const beer_query = `INSERT INTO beer VALUES(default, '${beer.name.replaceAll("'", "''")}', 
    '${beer.tagline.replaceAll("'", "''")}', '${first_brewed}', '${beer.description.replaceAll("'", "''")}', ${image_url}, 
      (SELECT max(id) FROM beer_characteristics), (SELECT max(id) - 1 FROM amount), (SELECT max(id) FROM amount),
       '${beer.brewers_tips.replaceAll("'", "''")}', '${beer.contributed_by}');`;
    insert_beer_query.push(beer_characteristics_query);
    insert_beer_query.push(beer_volume_query);
    insert_beer_query.push(beer_boil_volume_query);
    insert_beer_query.push(beer_query);

    const ingredients = beer.ingredients;

    for (const malt of ingredients.malt) {
      if (malt.amount.value === null) break;
      const malt_amount_query = `INSERT INTO amount VALUES(default, '${malt.amount.value}', '${malt.amount.unit}');`;
      const malt_query = `INSERT INTO ingredient VALUES(default, '${malt.name}', 'malt', null, null, (SELECT max(id) FROM amount));`;
      const beer_ingredient_query = "INSERT INTO beer_ingredient VALUES((SELECT max(id) FROM beer), (SELECT max(id) FROM ingredient));";
      insert_beer_query.push(malt_amount_query);
      insert_beer_query.push(malt_query);
      insert_beer_query.push(beer_ingredient_query);
    }

    for (const hops of ingredients.hops) {
      if (hops.amount.value === null) break;
      const hops_amount_query = `INSERT INTO amount VALUES(default, '${hops.amount.value}', '${hops.amount.unit}');`;
      const hops_query = `INSERT INTO ingredient VALUES(default, '${hops.name}', 'hops', '${hops.add}', '${hops.attribute}', (SELECT max(id) FROM amount));`;
      const beer_ingredient_query = "INSERT INTO beer_ingredient VALUES((SELECT max(id) FROM beer), (SELECT max(id) FROM ingredient));";
      insert_beer_query.push(hops_amount_query);
      insert_beer_query.push(hops_query);
      insert_beer_query.push(beer_ingredient_query);
    }
    const ingredient_yeast = ingredients.yeast ? ingredients.yeast : "Not specified";
    const yeast_query = `INSERT INTO ingredient VALUES(default, '${ingredient_yeast}', 'yeast', null, null, null);`;
    const beer_ingredient_query = "INSERT INTO beer_ingredient VALUES((SELECT max(id) FROM beer), (SELECT max(id) FROM ingredient));";
    insert_beer_query.push(yeast_query);
    insert_beer_query.push(beer_ingredient_query);

    const method = beer.method;

    for (const mash_temp of method.mash_temp) {
      if (mash_temp.temp.value === null) break;
      const duration = mash_temp.duration ? `'${mash_temp.duration}'` : null;
      const temp_amount_querty = `INSERT INTO amount VALUES(default, '${mash_temp.temp.value}', '${mash_temp.temp.unit}');`;
      const temp_query = `INSERT INTO method VALUES(default, 'mash_temp', (SELECT max(id) FROM amount), ${duration});`;
      const beer_method_query = "INSERT INTO beer_method VALUES((SELECT max(id) FROM beer), (SELECT max(id) FROM method));";
      insert_beer_query.push(temp_amount_querty);
      insert_beer_query.push(temp_query);
      insert_beer_query.push(beer_method_query);
    }

    if (method.fermentation.temp.value !== null) {
      const temp_amount_query = `INSERT INTO amount VALUES(default, '${method.fermentation.temp.value}', '${method.fermentation.temp.unit}');`;
      const fermentation_query = `INSERT INTO method VALUES(default, 'fermentation', (SELECT max(id) FROM amount), null);`;
      const beer_method_query = "INSERT INTO beer_method VALUES((SELECT max(id) FROM beer), (SELECT max(id) FROM method));";
      insert_beer_query.push(temp_amount_query);
      insert_beer_query.push(fermentation_query);
      insert_beer_query.push(beer_method_query);
    }

    for (const food of beer.food_pairing) {
      const food_cleaned = food.replaceAll("'", "''");
      const food_query = `INSERT INTO food(food) SELECT '${food_cleaned}' WHERE NOT EXISTS(SELECT food FROM food WHERE food = '${food_cleaned}');`;

      const food_pairing_query = `INSERT INTO food_pairing VALUES((SELECT max(id) FROM beer), (SELECT id FROM food WHERE food = '${food_cleaned}'));`;
      insert_beer_query.push(food_query);
      insert_beer_query.push(food_pairing_query);
    }
    insert_beer_query.push("\n");
  }

  fs.appendFile("populate_tables.sql", insert_beer_query.join("\n"), function (err) {
    if (err) throw err;
    console.log("Saved!");
  });
};
