const dgraph = require("./dgraph-graphql");
const validate = require("./validate");
const { InvalidData, InsufData, InsufParam, InsufQuery, NodeNotFound } = require("./errors");

const checkItem = validate({
  name: {
    type: String,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  inStock: {
    type: Number,
    required: true,
    validation(val){
      return val > -2;
    }
  },
  qty: {
    type: String,
    required: true
  }
})

module.exports = {
  async addItem(req, res){
    try {
      let pharmaId = req.user.id
      let itemData = checkItem(req.body);
      itemData.pharmacy = {pharmaId};
      let q = dgraph.insert("InvItem", itemData, ["itemId"]);
      let r = await dgraph.run(q);
      res.json({
        success: true,
        itemId: r.addInvItem.invItem[0].itemId
      })
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async getItems(req, res){
    try {
      let pharmaId = req.user.id;
      let q = dgraph.get("Pharmacy", "pharmaId", pharmaId, [["inventory", "itemId", "name", "inStock", "rate", "qty"]]);
      let r = await dgraph.run(q);
      if(!r.getPharmacy) throw new NodeNotFound(pharmaId, "pharmaId");
      res.json({
        pharmaId,
        items: r.getPharmacy.inventory
      })
    } catch(e){
      console.log(e);
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  },

  async updateInStock(req, res){
    try {
      let {itemId, addStock} = req.params;
      if(!itemId || !addStock || isNaN(parseInt(addStock))) throw new InsufParam("'itemId' and 'addStock' is mandatory and 'addStock' must be integer");
      let q = dgraph.get("InvItem", "itemId", itemId, ["itemId", "inStock"]);
      let r = await dgraph.run(q);
      if(!r.getInvItem) throw new NodeNotFound(itemId, "itemId");
      let inStock = r.getInvItem.inStock+parseInt(addStock)
      q = dgraph.update("InvItem", {filter: {itemId}, set: {inStock}}, ["itemId", "inStock"]);
      r = await dgraph.run(q);
      res.json({
        success: true,
        updatedItem: r.updateInvItem.invItem[0]
      })
    } catch(e){
      e = parseError(e);
      res.status(e.code).json(e.e);
    }
  }
}