'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Users extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // User has many Workspaces (as owner)
      Users.hasMany(models.Workspaces, {
        foreignKey: 'owner_id',
        as: 'ownedWorkspaces'
      });

      // User has many Workspace_Members
      Users.hasMany(models.Workspace_Members, {
        foreignKey: 'user_id',
        as: 'workspaceMemberships'
      });

      // User has many Project_Members
      Users.hasMany(models.Project_Member, {
        foreignKey: 'user_id',
        as: 'projectMemberships'
      });

      // User has many Projects (as leader)
      Users.hasMany(models.Project, {
        foreignKey: 'leader_id',
        as: 'ledProjects'
      });

      // User has many Projects (as creator)
      Users.hasMany(models.Project, {
        foreignKey: 'created_by',
        as: 'createdProjects'
      });

      // User has many Tasks (as assigned)
      Users.hasMany(models.Task, {
        foreignKey: 'assigned_to',
        as: 'assignedTasks'
      });

      // User watches many Tasks
      Users.belongsToMany(models.Task, {
        through: models.Task_Watcher,
        foreignKey: 'user_id',
        otherKey: 'task_id',
        as: 'watchingTasks'
      });

      // User has many Task Activities
      Users.hasMany(models.Task_Activity, {
        foreignKey: 'user_id',
        as: 'taskActivities'
      });

      // User has many Notifications
      Users.hasMany(models.Notification, {
        foreignKey: 'user_id',
        as: 'notifications'
      });

      // User has many Conversations (creator)
      Users.hasMany(models.Conversation, {
        foreignKey: 'created_by',
        as: 'createdConversations'
      });

      // User has many Conversation memberships
      Users.hasMany(models.Conversation_Member, {
        foreignKey: 'user_id',
        as: 'conversationMemberships'
      });

      // User has many sent messages
      Users.hasMany(models.Message, {
        foreignKey: 'sender_id',
        as: 'sentMessages'
      });

      // User has many call sessions as caller
      Users.hasMany(models.Call_Session, {
        foreignKey: 'caller_id',
        as: 'outgoingCalls'
      });

      // User has many call sessions as callee
      Users.hasMany(models.Call_Session, {
        foreignKey: 'callee_id',
        as: 'incomingCalls'
      });
    }
  }
  Users.init({
    id: {
      type : DataTypes.STRING,
      primaryKey : true,
      allowNull : false,
      unique : true
    },
    username: {
      type : DataTypes.STRING,
      allowNull : false
    },
    email: {
      type : DataTypes.STRING,
      allowNull : false,
      unique : true
    },
    password: { 
      type : DataTypes.STRING,
      allowNull : false
    },
    role: {
      type : DataTypes.ENUM('Admin', 'Leader', 'Member'),
      allowNull : false
    },
    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resetTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    avatarUrl: {
      type: DataTypes.STRING(1024),
      allowNull: true
    },
    avatarPublicId: {
      type: DataTypes.STRING(512),
      allowNull: true
    },
    kpiScore: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true
    },
    kpiModelAtSignup: {
      type: DataTypes.STRING(1),
      allowNull: true
    },
    cpa: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true
    },
    yearsAtCompany: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0
    },
    interviewScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    cvScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    yearsExperience: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0
    },
    numProjectsPrior: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    createdAt : {
      type : DataTypes.DATE,
      allowNull : false
    },
    updatedAt : {
      type : DataTypes.DATE,
      allowNull : false
    }
  }, {
    sequelize,
    modelName: 'Users',
    timestamps: true,
    underscored: false
  });
  
  return Users;
};