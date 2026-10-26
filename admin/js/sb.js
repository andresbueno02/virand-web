/* Capa de datos del panel: única puerta a Supabase (fácil de sustituir en pruebas). */
(function (root) {
  var C = root.VIRAND_CONFIG, client = null;
  function init() {
    client = root.__SB_CLIENT__ || root.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    return client;
  }
  function must(r) { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data; }
  var Api = {
    init: init,
    session: function () { return client.auth.getSession().then(function (r) { return r.data && r.data.session; }); },
    signIn: function (email, pw) { return client.auth.signInWithPassword({ email: email, password: pw }).then(must); },
    signOut: function () { return client.auth.signOut(); },
    isAdmin: function () { return client.rpc('is_admin').then(function (r) { return !r.error && r.data === true; }); },

    listFlats: function () { return client.from('flats').select('*').order('sort').then(must); },
    getFlat: function (id) { return client.from('flats').select('*').eq('id', id).single().then(must); },
    photos: function (flatId) { return client.from('flat_photos').select('*').eq('flat_id', flatId).order('sort').then(must); },
    saveFlat: function (row) {
      var id = row.id; if (id) { delete row.id; }
      return (id ? client.from('flats').update(row).eq('id', id) : client.from('flats').insert(row)).select().single().then(must);
    },
    setActive: function (id, v) { return client.from('flats').update({ active: v }).eq('id', id).then(must); },

    list: function (table) { return client.from(table).select('*').order('sort').then(must); },
    save: function (table, row) {
      var id = row.id; if (id) { delete row.id; }
      return (id ? client.from(table).update(row).eq('id', id) : client.from(table).insert(row)).select().single().then(must);
    },
    remove: function (table, id) { return client.from(table).delete().eq('id', id).then(must); },
    setSort: function (table, id, sort) { return client.from(table).update({ sort: sort }).eq('id', id).then(must); },

    uploadPhoto: function (path, blob) {
      return client.storage.from('flats').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }).then(must);
    },
    removeStorage: function (paths) { return paths.length ? client.storage.from('flats').remove(paths).then(must) : Promise.resolve([]); },
    addPhoto: function (row) { return client.from('flat_photos').insert(row).select().single().then(must); },
    updatePhoto: function (id, patch) { return client.from('flat_photos').update(patch).eq('id', id).then(must); },
    removePhoto: function (id) { return client.from('flat_photos').delete().eq('id', id).then(must); },
    updateFlatPrices: function (id, low, high) { return client.from('flats').update({ base_price: low, price_high: high }).eq('id', id).then(must); },
    listSeasons: function () { return client.from('seasons').select('*').order('from_date').then(must); },
    saveSeason: function (row) {
      var id = row.id; if (id) { delete row.id; }
      return (id ? client.from('seasons').update(row).eq('id', id) : client.from('seasons').insert(row)).select().single().then(must);
    },
    removeSeason: function (id) { return client.from('seasons').delete().eq('id', id).then(must); },
    dayPrices: function (flatId, fromDay) { return client.from('day_prices').select('*').eq('flat_id', flatId).order('day').then(must).then(function (rows) { return rows.filter(function (r) { return r.day >= fromDay; }); }); },
    setDayPrices: function (flatId, days, price) {
      return client.from('day_prices').upsert(days.map(function (d) { return { flat_id: flatId, day: d, price: price }; }), { onConflict: 'flat_id,day' }).then(must);
    },
    clearDayPrices: function (flatId, days) { return client.from('day_prices').delete().eq('flat_id', flatId).in('day', days).then(must); },

    listTexts: function () { return client.from('site_texts').select('*').then(must); },
    saveTexts: function (rows) { return client.from('site_texts').upsert(rows, { onConflict: 'key,lang' }).then(must); }
  };
  root.Api = Api;
})(window);
