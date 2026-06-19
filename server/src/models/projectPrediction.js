'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Project_Prediction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Project_Prediction.belongsTo(models.Project, {
        foreignKey: 'project_id',
        as: 'project'
      });
    }
  }
  Project_Prediction.init({
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    project_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Projects',
        key: 'id'
      }
    },
    estimated_completion_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    actual_completion_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    progress_percentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    delay_risk_level: {
      type: DataTypes.ENUM('Low', 'Medium', 'High'),
      defaultValue: 'Low'
    },
    delay_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Project_Prediction',
    tableName: 'Project_Prediction',
    timestamps: true,
    underscored: false
  });
  
  return Project_Prediction;
};

