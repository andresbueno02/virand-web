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
    listAllPhotos: function () { return client.from('flat_photos').select('flat_id,path,sort').order('sort').then(must); },
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
    // Propone traducciones ES->EN con Gemini (función translate). items: [{key, es}] -> [{key, en, warn?}]
    translate: function (items) {
      return client.functions.invoke('translate', { body: { items: items } }).then(function (r) {
        if (!r.error) return r.data.items;
        var m = r.error.message || 'No se ha podido traducir.';
        var ctx = r.error.context;
        if (ctx && ctx.json) return ctx.json().then(function (j) { throw new Error(j && j.error ? j.error : m); }, function () { throw new Error(m); });
        throw new Error(m);
      });
    },
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
    saveTexts: function (rows) { return client.from('site_texts').upsert(rows, { onConflict: 'key,lang' }).then(must); },

    listBookings: function (flatId) { return client.from('bookings').select('*').eq('flat_id', flatId).order('check_in').then(must); },
    saveBooking: function (row) {
      var id = row.id; if (id) { delete row.id; }
      return (id ? client.from('bookings').update(row).eq('id', id) : client.from('bookings').insert(row)).select().single().then(must);
    },
    removeBooking: function (id) { return client.from('bookings').delete().eq('id', id).then(must); },
    listIcalSources: function (flatId) {
      var q = client.from('ical_sources').select('*').order('label');
      return (flatId ? q.eq('flat_id', flatId) : q).then(must);
    },
    saveIcalSource: function (row) {
      var id = row.id; if (id) { delete row.id; }
      return (id ? client.from('ical_sources').update(row).eq('id', id) : client.from('ical_sources').insert(row)).select().single().then(must);
    },
    removeIcalSource: function (id) { return client.from('ical_sources').delete().eq('id', id).then(must); },
    listIcalBlocks: function (flatId) { return client.from('ical_blocks').select('*').eq('flat_id', flatId).order('start_date').then(must); },
    syncIcal: function (flatId) {
      return client.functions.invoke('sync-ical', { body: flatId ? { flat_id: flatId } : {} }).then(function (r) {
        if (!r.error) return r.data;
        var m = r.error.message || 'No se pudo sincronizar el calendario.';
        var ctx = r.error.context;
        if (ctx && ctx.json) return ctx.json().then(function (j) { throw new Error(j && j.error ? j.error : m); }, function () { throw new Error(m); });
        throw new Error(m);
      });
    },

    listIssuers: function () { return client.from('issuers').select('*').order('name').then(must); },
    saveIssuer: function (row) {
      var id = row.id; if (id) delete row.id;
      return (id ? client.from('issuers').update(row).eq('id', id) : client.from('issuers').insert(row)).select().single().then(must);
    },
    removeIssuer: function (id) { return client.from('issuers').delete().eq('id', id).then(must); },
    setFlatIssuer: function (flatId, issuerId) { return client.from('flats').update({ issuer_id: issuerId || null }).eq('id', flatId).then(must); },
    getBooking: function (id) { return client.from('bookings').select('*').eq('id', id).single().then(must); },
    listInvoices: function (year) {
      var q = client.from('invoices').select('*').order('issue_date', { ascending: false }).order('seq', { ascending: false });
      return (year ? q.eq('year', year) : q).then(must);
    },
    issueInvoice: function (payload) { return client.rpc('issue_invoice', { p: payload }).then(must); }
  };
  root.Api = Api;
})(window);
