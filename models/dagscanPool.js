const mongoose = require('mongoose');
const dagscanPoolSchema = new mongoose.Schema({}, { strict:false, timestamps:true, autoIndex:true, collection:'zealousswappools' });
dagscanPoolSchema.index({ poolAddress:1 }, { unique:true, partialFilterExpression:{ poolAddress:{ $type:'string' } } });
dagscanPoolSchema.index({ address:1 }, { unique:true, partialFilterExpression:{ address:{ $type:'string' } } });
dagscanPoolSchema.index({ dex:1, poolAddress:1 }, { unique:true, partialFilterExpression:{ dex:{ $exists:true, $type:'string' }, poolAddress:{ $type:'string' } } });
module.exports = mongoose.models.DagscanPool || mongoose.model('DagscanPool', dagscanPoolSchema);
