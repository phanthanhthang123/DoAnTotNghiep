'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Progress extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Progress.belongsTo(models.Project, {
        foreignKey: 'project_id',
        as: 'project'
      });
    }
  }
  Progress.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    project_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    progress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate:{
          min: 0,
          max: 100
      }
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Progress',
    tableName: 'Progress',
    timestamps: true,
    createdAt: false,
    underscored: false
  });
  
  return Progress;
};

